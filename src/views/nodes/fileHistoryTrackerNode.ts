'use strict';
import { Disposable, TextEditor, TreeItem, TreeItemCollapsibleState, window } from 'vscode';
import { UriComparer } from '../../comparers';
import { Container } from '../../container';
import { FileHistoryView } from '../fileHistoryView';
import { FileHistoryNode } from './fileHistoryNode';
import { GitReference, GitRevision } from '../../git/git';
import { GitCommitish, GitUri } from '../../git/gitUri';
import { Logger } from '../../logger';
import { ReferencePicker } from '../../quickpicks';
import { debug, Functions, gate, log } from '../../system';
import { ContextValues, SubscribeableViewNode, unknownGitUri, ViewNode } from './viewNode';
import { ContextKeys, setContext } from '../../constants';

export class FileHistoryTrackerNode extends SubscribeableViewNode<FileHistoryView> {
	private _base: string | undefined;
	private _child: FileHistoryNode | undefined;
	protected splatted = true;

	constructor(view: FileHistoryView) {
		super(unknownGitUri, view);
	}

	dispose() {
		super.dispose();

		this.resetChild();
	}

	@debug()
	private resetChild() {
		if (this._child == null) return;

		this._child.dispose();
		this._child = undefined;
	}

	async getChildren(): Promise<ViewNode[]> {
		if (this._child == null) {
			if (!this.hasUri) {
				this.view.description = undefined;

				this.view.message = 'There are no editors open that can provide file history information.';
				return [];
			}

			this.view.message = undefined;

			const commitish: GitCommitish = {
				...this.uri,
				repoPath: this.uri.repoPath!,
				sha: this._base ?? this.uri.sha,
			};
			const fileUri = new GitUri(this.uri, commitish);

			let branch;
			if (!commitish.sha || commitish.sha === 'HEAD') {
				branch = await Container.git.getBranch(this.uri.repoPath);
			} else if (!GitRevision.isSha(commitish.sha)) {
				[branch] = await Container.git.getBranches(this.uri.repoPath, {
					filter: b => b.name === commitish.sha,
				});
			}
			this._child = new FileHistoryNode(fileUri, this.view, this, branch);
		}

		return this._child.getChildren();
	}

	getTreeItem(): TreeItem {
		this.splatted = false;

		const item = new TreeItem('File History', TreeItemCollapsibleState.Expanded);
		item.contextValue = ContextValues.ActiveFileHistory;

		return item;
	}

	get followingEditor(): boolean {
		return this.canSubscribe;
	}

	get hasUri(): boolean {
		return this._uri != unknownGitUri;
	}

	@gate()
	@log()
	async changeBase() {
		const pick = await ReferencePicker.show(
			this.uri.repoPath!,
			'Change File History Base',
			'Choose a reference to set as the new base',
			{
				allowEnteringRefs: true,
				picked: this._base,
				// checkmarks: true,
				sort: { branches: { current: true }, tags: {} },
			},
		);
		if (pick == null) return;

		if (GitReference.isBranch(pick)) {
			const branch = await Container.git.getBranch(this.uri.repoPath);
			this._base = branch?.name === pick.name ? undefined : pick.ref;
		} else {
			this._base = pick.ref;
		}
		if (this._child == null) return;

		this.setUri();
		await this.triggerChange();
	}

	@gate()
	@debug({
		exit: r => `returned ${r}`,
	})
	async refresh(reset: boolean = false) {
		const cc = Logger.getCorrelationContext();

		if (reset) {
			this.setUri();
			this.resetChild();
		}

		const editor = window.activeTextEditor;
		if (editor == null || !Container.git.isTrackable(editor.document.uri)) {
			if (
				!this.hasUri ||
				(Container.git.isTrackable(this.uri) &&
					window.visibleTextEditors.some(e => e.document?.uri.path === this.uri.path))
			) {
				return true;
			}

			this.setUri();
			this.resetChild();

			if (cc != null) {
				cc.exitDetails = `, uri=${Logger.toLoggable(this._uri)}`;
			}
			return false;
		}

		if (editor.document.uri.path === this.uri.path) {
			if (cc != null) {
				cc.exitDetails = `, uri=${Logger.toLoggable(this._uri)}`;
			}
			return true;
		}

		let gitUri = await GitUri.fromUri(editor.document.uri);

		let uri;
		if (gitUri.sha != null) {
			// If we have a sha, normalize the history to the working file (so we get a full history all the time)
			const workingUri = await Container.git.getWorkingUri(gitUri.repoPath!, gitUri);
			if (workingUri != null) {
				uri = workingUri;
			}
		}

		if (this.hasUri && UriComparer.equals(uri ?? gitUri, this.uri)) {
			return true;
		}

		if (uri != null) {
			gitUri = await GitUri.fromUri(uri);
		}

		this.setUri(gitUri);
		this.resetChild();

		if (cc != null) {
			cc.exitDetails = `, uri=${Logger.toLoggable(this._uri)}`;
		}
		return false;
	}

	@log()
	setEditorFollowing(enabled: boolean) {
		if (enabled) {
			this.setUri();
			// Don't need to call triggerChange here, since canSubscribe will do it
		}

		this.canSubscribe = enabled;
	}

	@log()
	async showHistoryForUri(uri: GitUri) {
		this.setUri(uri);
		await this.triggerChange();
	}

	@debug()
	protected subscribe() {
		return Disposable.from(
			window.onDidChangeActiveTextEditor(Functions.debounce(this.onActiveEditorChanged, 250), this),
		);
	}

	@debug({ args: false })
	private onActiveEditorChanged(_editor: TextEditor | undefined) {
		void this.triggerChange();
	}

	private setUri(uri?: GitUri) {
		this._uri = uri ?? unknownGitUri;
		void setContext(ContextKeys.ViewsFileHistoryCanPin, this.hasUri);
	}
}
