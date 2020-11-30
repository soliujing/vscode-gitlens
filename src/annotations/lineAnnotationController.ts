'use strict';
import {
	CancellationToken,
	CancellationTokenSource,
	ConfigurationChangeEvent,
	DecorationOptions,
	DecorationRangeBehavior,
	Disposable,
	Range,
	TextEditor,
	TextEditorDecorationType,
	window,
} from 'vscode';
import { Annotations } from './annotations';
import { configuration } from '../configuration';
import { GlyphChars, isTextEditor } from '../constants';
import { Container } from '../container';
import { Authentication, CommitFormatter, GitBlameCommit, PullRequest } from '../git/git';
import { LogCorrelationContext, Logger } from '../logger';
import { debug, Iterables, log, Promises } from '../system';
import { LinesChangeEvent, LineSelection } from '../trackers/gitLineTracker';

const annotationDecoration: TextEditorDecorationType = window.createTextEditorDecorationType({
	after: {
		margin: '0 0 0 3em',
		textDecoration: 'none',
	},
	rangeBehavior: DecorationRangeBehavior.ClosedOpen,
});

export class LineAnnotationController implements Disposable {
	private _cancellation: CancellationTokenSource | undefined;
	private readonly _disposable: Disposable;
	private _editor: TextEditor | undefined;
	private _enabled: boolean = false;

	constructor() {
		this._disposable = Disposable.from(
			configuration.onDidChange(this.onConfigurationChanged, this),
			Container.fileAnnotations.onDidToggleAnnotations(this.onFileAnnotationsToggled, this),
			Authentication.onDidChange(() => void this.refresh(window.activeTextEditor)),
		);
		this.onConfigurationChanged(configuration.initializingChangeEvent);
	}

	dispose() {
		this.clearAnnotations(this._editor);

		Container.lineTracker.stop(this);
		this._disposable.dispose();
	}

	private onConfigurationChanged(e: ConfigurationChangeEvent) {
		if (!configuration.changed(e, 'currentLine')) return;

		if (configuration.changed(e, 'currentLine', 'enabled')) {
			if (Container.config.currentLine.enabled) {
				this._enabled = true;
				this.resume();
			} else {
				this._enabled = false;
				this.setLineTracker(false);
			}
		}

		void this.refresh(window.activeTextEditor);
	}

	private _suspended: boolean = false;
	get suspended() {
		return !this._enabled || this._suspended;
	}

	@log()
	resume() {
		this.setLineTracker(true);

		if (this._suspended) {
			this._suspended = false;
			return true;
		}

		return false;
	}

	@log()
	suspend() {
		this.setLineTracker(false);

		if (!this._suspended) {
			this._suspended = true;
			return true;
		}

		return false;
	}

	@debug({
		args: {
			0: (e: LinesChangeEvent) =>
				`editor=${e.editor?.document.uri.toString(true)}, selections=${e.selections
					?.map(s => `[${s.anchor}-${s.active}]`)
					.join(',')}, pending=${Boolean(e.pending)}, reason=${e.reason}`,
		},
	})
	private onActiveLinesChanged(e: LinesChangeEvent) {
		if (!e.pending && e.selections !== undefined) {
			void this.refresh(e.editor);

			return;
		}

		this.clear(e.editor);
	}

	private onFileAnnotationsToggled() {
		void this.refresh(window.activeTextEditor);
	}

	@debug({ args: false, singleLine: true })
	clear(editor: TextEditor | undefined) {
		this._cancellation?.cancel();
		if (this._editor !== editor && this._editor != null) {
			this.clearAnnotations(this._editor);
		}
		this.clearAnnotations(editor);
	}

	@log({ args: false })
	async toggle(editor: TextEditor | undefined) {
		this._enabled = !(this._enabled && !this.suspended);

		if (this._enabled) {
			if (this.resume()) {
				await this.refresh(editor);
			}
		} else if (this.suspend()) {
			await this.refresh(editor);
		}
	}

	private clearAnnotations(editor: TextEditor | undefined) {
		if (editor === undefined || (editor as any)._disposed === true) return;

		editor.setDecorations(annotationDecoration, []);
	}

	private async getPullRequests(
		repoPath: string,
		lines: [number, GitBlameCommit][],
		{ timeout }: { timeout?: number } = {},
	) {
		if (lines.length === 0) return undefined;

		const remote = await Container.git.getRichRemoteProvider(repoPath);
		if (remote?.provider == null) return undefined;

		const refs = new Set<string>();

		for (const [, commit] of lines) {
			refs.add(commit.ref);
		}

		if (refs.size === 0) return undefined;

		const { provider } = remote;
		const prs = await Promises.raceAll(
			refs.values(),
			ref => Container.git.getPullRequestForCommit(ref, provider),
			timeout,
		);
		if (prs.size === 0 || Iterables.every(prs.values(), pr => pr == null)) return undefined;

		return prs;
	}

	@debug({ args: false })
	private async refresh(editor: TextEditor | undefined, options?: { prs?: Map<string, PullRequest | undefined> }) {
		if (editor == null && this._editor == null) return;

		const cc = Logger.getCorrelationContext();

		const selections = Container.lineTracker.selections;
		if (editor == null || selections == null || !isTextEditor(editor)) {
			if (cc != null) {
				cc.exitDetails = ` ${GlyphChars.Dot} Skipped because there is no valid editor or no valid selections`;
			}

			this.clear(this._editor);
			return;
		}

		if (this._editor !== editor) {
			// Clear any annotations on the previously active editor
			this.clear(this._editor);

			this._editor = editor;
		}

		const cfg = Container.config.currentLine;
		if (this.suspended) {
			if (cc != null) {
				cc.exitDetails = ` ${GlyphChars.Dot} Skipped because the controller is suspended`;
			}

			this.clear(editor);
			return;
		}

		const trackedDocument = await Container.tracker.getOrAdd(editor.document);
		if (!trackedDocument.isBlameable && this.suspended) {
			if (cc != null) {
				cc.exitDetails = ` ${GlyphChars.Dot} Skipped because the ${
					this.suspended
						? 'controller is suspended'
						: `document(${trackedDocument.uri.toString(true)}) is not blameable`
				}`;
			}

			this.clear(editor);
			return;
		}

		// Make sure the editor hasn't died since the await above and that we are still on the same line(s)
		if (editor.document == null || !Container.lineTracker.includes(selections)) {
			if (cc != null) {
				cc.exitDetails = ` ${GlyphChars.Dot} Skipped because the ${
					editor.document == null
						? 'editor is gone'
						: `selection(s)=${selections
								.map(s => `[${s.anchor}-${s.active}]`)
								.join()} are no longer current`
				}`;
			}
			return;
		}

		if (cc != null) {
			cc.exitDetails = ` ${GlyphChars.Dot} selection(s)=${selections
				.map(s => `[${s.anchor}-${s.active}]`)
				.join()}`;
		}

		const commitLines = [
			...Iterables.filterMap<LineSelection, [number, GitBlameCommit]>(selections, selection => {
				const state = Container.lineTracker.getState(selection.active);
				if (state?.commit == null) {
					Logger.debug(cc, `Line ${selection.active} returned no commit`);
					return undefined;
				}

				return [selection.active, state.commit];
			}),
		];

		const repoPath = trackedDocument.uri.repoPath;

		// TODO: Make this configurable?
		const timeout = 100;
		const [getBranchAndTagTips, prs] = await Promise.all([
			CommitFormatter.has(cfg.format, 'tips') ? Container.git.getBranchesAndTagsTipsFn(repoPath) : undefined,
			repoPath != null &&
			cfg.pullRequests.enabled &&
			CommitFormatter.has(
				cfg.format,
				'pullRequest',
				'pullRequestAgo',
				'pullRequestAgoOrDate',
				'pullRequestDate',
				'pullRequestState',
			)
				? options?.prs ??
				  this.getPullRequests(
						repoPath,
						commitLines.filter(([, commit]) => !commit.isUncommitted),
						{ timeout: timeout },
				  )
				: undefined,
		]);

		if (prs != null) {
			this._cancellation?.cancel();
			this._cancellation = new CancellationTokenSource();
			void this.waitForAnyPendingPullRequests(editor, prs, this._cancellation.token, timeout, cc);
		}

		const decorations = [];

		for (const [l, commit] of commitLines) {
			const decoration = Annotations.trailing(
				commit,
				// await GitUri.fromUri(editor.document.uri),
				// l,
				cfg.format,
				{
					dateFormat: cfg.dateFormat === null ? Container.config.defaultDateFormat : cfg.dateFormat,
					getBranchAndTagTips: getBranchAndTagTips,
					pullRequestOrRemote: prs?.get(commit.ref),
				},
				cfg.scrollable,
			) as DecorationOptions;
			decoration.range = editor.document.validateRange(
				new Range(l, Number.MAX_SAFE_INTEGER, l, Number.MAX_SAFE_INTEGER),
			);

			decorations.push(decoration);
		}

		editor.setDecorations(annotationDecoration, decorations);
	}

	private setLineTracker(enabled: boolean) {
		if (enabled) {
			if (!Container.lineTracker.isSubscribed(this)) {
				Container.lineTracker.start(
					this,
					Container.lineTracker.onDidChangeActiveLines(this.onActiveLinesChanged, this),
				);
			}

			return;
		}

		Container.lineTracker.stop(this);
	}

	private async waitForAnyPendingPullRequests(
		editor: TextEditor,
		prs: Map<
			string,
			PullRequest | Promises.CancellationErrorWithId<string, Promise<PullRequest | undefined>> | undefined
		>,
		cancellationToken: CancellationToken,
		timeout: number,
		cc: LogCorrelationContext | undefined,
	) {
		// If there are any PRs that timed out, refresh the annotation(s) once they complete
		const count = Iterables.count(prs.values(), pr => pr instanceof Promises.CancellationError);
		if (cancellationToken.isCancellationRequested || count === 0) return;

		Logger.debug(cc, `${GlyphChars.Dot} ${count} pull request queries took too long (over ${timeout} ms)`);

		const resolved = new Map<string, PullRequest | undefined>();
		for (const [key, value] of prs) {
			resolved.set(key, value instanceof Promises.CancellationError ? await value.promise : value);
		}

		if (cancellationToken.isCancellationRequested || editor !== this._editor) return;

		Logger.debug(cc, `${GlyphChars.Dot} ${count} pull request queries completed; refreshing...`);

		void this.refresh(editor, { prs: resolved });
	}
}
