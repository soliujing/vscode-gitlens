'use strict';
import {
	CancellationToken,
	commands,
	ConfigurationChangeEvent,
	Disposable,
	MarkdownString,
	ProgressLocation,
	TreeItem,
	TreeItemCollapsibleState,
	window,
} from 'vscode';
import { CommitsViewConfig, configuration, ViewFilesLayout, ViewShowBranchComparison } from '../configuration';
import { ContextKeys, GlyphChars, setContext } from '../constants';
import { Container } from '../container';
import {
	GitLogCommit,
	GitReference,
	GitRemote,
	GitRevisionReference,
	Repository,
	RepositoryChange,
	RepositoryChangeComparisonMode,
	RepositoryChangeEvent,
} from '../git/git';
import { GitUri } from '../git/gitUri';
import {
	BranchNode,
	BranchTrackingStatusNode,
	ContextValues,
	RepositoryFolderNode,
	RepositoryNode,
	unknownGitUri,
	ViewNode,
} from './nodes';
import { debug, Functions, gate, Strings } from '../system';
import { ViewBase } from './viewBase';

export class CommitsRepositoryNode extends RepositoryFolderNode<CommitsView, BranchNode> {
	async getChildren(): Promise<ViewNode[]> {
		if (this.child == null) {
			const branch = await this.repo.getBranch();
			if (branch == null) {
				this.view.message = 'No commits could be found.';

				return [];
			}

			this.view.message = undefined;

			let authors;
			if (this.view.state.myCommitsOnly) {
				const user = await Container.git.getCurrentUser(this.repo.path);
				if (user != null) {
					authors = [`^${user.name} <${user.email}>$`];
				}
			}

			this.child = new BranchNode(this.uri, this.view, this, branch, true, {
				expanded: true,
				showComparison: this.view.config.showBranchComparison,
				showCurrent: false,
				showTracking: true,
				authors: authors,
			});
		}

		return this.child.getChildren();
	}

	async getTreeItem(): Promise<TreeItem> {
		this.splatted = false;

		let expand = this.repo.starred;
		const [active, branch] = await Promise.all([
			expand ? undefined : Container.git.isActiveRepoPath(this.uri.repoPath),
			this.repo.getBranch(),
		]);
		if (!expand && (active || (branch?.state.ahead ?? 0) > 0 || (branch?.state.behind ?? 0) > 0)) {
			expand = true;
		}

		const item = new TreeItem(
			this.repo.formattedName ?? this.uri.repoPath ?? '',
			expand ? TreeItemCollapsibleState.Expanded : TreeItemCollapsibleState.Collapsed,
		);
		item.contextValue = `${ContextValues.RepositoryFolder}${this.repo.starred ? '+starred' : ''}`;

		if (branch != null) {
			const lastFetched = (await this.repo.getLastFetched()) ?? 0;

			const status = branch?.getTrackingStatus();
			item.description = `${this.repo.supportsChangeEvents ? '' : Strings.pad(GlyphChars.Warning, 1, 2)}${
				status ? `${status}${Strings.pad(GlyphChars.Dot, 1, 1)}` : ''
			}${branch.name}${
				lastFetched
					? `${Strings.pad(GlyphChars.Dot, 1, 1)}Last fetched ${Repository.formatLastFetched(lastFetched)}`
					: ''
			}`;

			let providerName;
			if (branch.tracking != null) {
				const providers = GitRemote.getHighlanderProviders(await Container.git.getRemotes(branch.repoPath));
				providerName = providers?.length ? providers[0].name : undefined;
			} else {
				const remote = await branch.getRemote();
				providerName = remote?.provider?.name;
			}

			item.tooltip = new MarkdownString(
				`${this.repo.formattedName ?? this.uri.repoPath ?? ''}${
					lastFetched
						? `${Strings.pad(GlyphChars.Dash, 2, 2)}Last fetched ${Repository.formatLastFetched(
								lastFetched,
								false,
						  )}`
						: ''
				}${this.repo.formattedName ? `\n${this.uri.repoPath}` : ''}\n\nCurrent branch $(git-branch) ${
					branch.name
				}${
					branch.tracking
						? ` is ${branch.getTrackingStatus({
								empty: `up to date with $(git-branch) ${branch.tracking}${
									providerName ? ` on ${providerName}` : ''
								}`,
								expand: true,
								icons: true,
								separator: ', ',
								suffix: ` $(git-branch) ${branch.tracking}${providerName ? ` on ${providerName}` : ''}`,
						  })}`
						: `hasn't been published to ${providerName ?? 'a remote'}`
				}${
					this.repo.supportsChangeEvents
						? ''
						: `\n\n${GlyphChars.Warning} Unable to automatically detect repository changes`
				}`,
				true,
			);
		}

		return item;
	}

	@gate()
	@debug()
	async refresh(reset: boolean = false) {
		if (reset) {
			this.child = undefined;
		} else {
			void this.parent?.triggerChange(false);
		}

		await this.ensureSubscription();
	}

	@debug()
	protected async subscribe() {
		const lastFetched = (await this.repo?.getLastFetched()) ?? 0;

		const interval = Repository.getLastFetchedUpdateInterval(lastFetched);
		if (lastFetched !== 0 && interval > 0) {
			return Disposable.from(
				await super.subscribe(),
				Functions.interval(() => {
					// Check if the interval should change, and if so, reset it
					if (interval !== Repository.getLastFetchedUpdateInterval(lastFetched)) {
						void this.resetSubscription();
					}

					if (this.splatted) {
						void this.view.triggerNodeChange(this.parent ?? this);
					} else {
						void this.view.triggerNodeChange(this);
					}
				}, interval),
			);
		}

		return super.subscribe();
	}

	protected changed(e: RepositoryChangeEvent) {
		return e.changed(
			RepositoryChange.Config,
			RepositoryChange.Heads,
			RepositoryChange.Index,
			RepositoryChange.Remotes,
			RepositoryChange.Status,
			RepositoryChange.Unknown,
			RepositoryChangeComparisonMode.Any,
		);
	}
}

export class CommitsViewNode extends ViewNode<CommitsView> {
	protected splatted = true;
	private children: CommitsRepositoryNode[] | undefined;

	constructor(view: CommitsView) {
		super(unknownGitUri, view);
	}

	async getChildren(): Promise<ViewNode[]> {
		if (this.children == null) {
			const repositories = await Container.git.getOrderedRepositories();
			if (repositories.length === 0) {
				this.view.message = 'No commits could be found.';

				return [];
			}

			this.view.message = undefined;

			const splat = repositories.length === 1;
			this.children = repositories.map(
				r => new CommitsRepositoryNode(GitUri.fromRepoPath(r.path), this.view, this, r, splat),
			);
		}

		if (this.children.length === 1) {
			const [child] = this.children;

			const branch = await child.repo.getBranch();
			if (branch != null) {
				const lastFetched = (await child.repo.getLastFetched()) ?? 0;

				const status = branch.getTrackingStatus();
				this.view.description = `${status ? `${status} ${GlyphChars.Dot} ` : ''}${branch.name}${
					branch.rebasing ? ' (Rebasing)' : ''
				}${lastFetched ? ` ${GlyphChars.Dot} Last fetched ${Repository.formatLastFetched(lastFetched)}` : ''}${
					child.repo.supportsChangeEvents
						? ''
						: `${Strings.pad(GlyphChars.Warning, 3, 2)}Auto-refresh unavailable`
				}`;
			} else {
				this.view.description = child.repo.supportsChangeEvents
					? undefined
					: `${Strings.pad(GlyphChars.Warning, 1, 2)}Auto-refresh unavailable`;
			}

			return child.getChildren();
		}

		return this.children;
	}

	getTreeItem(): TreeItem {
		const item = new TreeItem('Commits', TreeItemCollapsibleState.Expanded);
		return item;
	}

	async getSplattedChild() {
		if (this.children == null) {
			await this.getChildren();
		}

		return this.children?.length === 1 ? this.children[0] : undefined;
	}

	@gate()
	@debug()
	refresh(reset: boolean = false) {
		if (reset && this.children != null) {
			for (const child of this.children) {
				child.dispose();
			}
			this.children = undefined;
		}
	}
}

interface CommitsViewState {
	myCommitsOnly?: boolean;
}

export class CommitsView extends ViewBase<CommitsViewNode, CommitsViewConfig> {
	protected readonly configKey = 'commits';

	constructor() {
		super('gitlens.views.commits', 'Commits');
	}

	private readonly _state: CommitsViewState = {};
	get state(): CommitsViewState {
		return this._state;
	}

	getRoot() {
		return new CommitsViewNode(this);
	}

	protected registerCommands() {
		void Container.viewCommands;

		commands.registerCommand(
			this.getQualifiedCommand('copy'),
			() => commands.executeCommand('gitlens.views.copy', this.selection),
			this,
		);
		commands.registerCommand(
			this.getQualifiedCommand('refresh'),
			async () => {
				await Container.git.resetCaches('branches', 'status', 'tags');
				return this.refresh(true);
			},
			this,
		);
		commands.registerCommand(
			this.getQualifiedCommand('setFilesLayoutToAuto'),
			() => this.setFilesLayout(ViewFilesLayout.Auto),
			this,
		);
		commands.registerCommand(
			this.getQualifiedCommand('setFilesLayoutToList'),
			() => this.setFilesLayout(ViewFilesLayout.List),
			this,
		);
		commands.registerCommand(
			this.getQualifiedCommand('setFilesLayoutToTree'),
			() => this.setFilesLayout(ViewFilesLayout.Tree),
			this,
		);
		commands.registerCommand(
			this.getQualifiedCommand('setMyCommitsOnlyOn'),
			() => this.setMyCommitsOnly(true),
			this,
		);
		commands.registerCommand(
			this.getQualifiedCommand('setMyCommitsOnlyOff'),
			() => this.setMyCommitsOnly(false),
			this,
		);
		commands.registerCommand(this.getQualifiedCommand('setShowAvatarsOn'), () => this.setShowAvatars(true), this);
		commands.registerCommand(this.getQualifiedCommand('setShowAvatarsOff'), () => this.setShowAvatars(false), this);
		commands.registerCommand(
			this.getQualifiedCommand('setShowBranchComparisonOn'),
			() => this.setShowBranchComparison(true),
			this,
		);
		commands.registerCommand(
			this.getQualifiedCommand('setShowBranchComparisonOff'),
			() => this.setShowBranchComparison(false),
			this,
		);
		commands.registerCommand(
			this.getQualifiedCommand('setShowBranchPullRequestOn'),
			() => this.setShowBranchPullRequest(true),
			this,
		);
		commands.registerCommand(
			this.getQualifiedCommand('setShowBranchPullRequestOff'),
			() => this.setShowBranchPullRequest(false),
			this,
		);
	}

	protected filterConfigurationChanged(e: ConfigurationChangeEvent) {
		const changed = super.filterConfigurationChanged(e);
		if (
			!changed &&
			!configuration.changed(e, 'defaultDateFormat') &&
			!configuration.changed(e, 'defaultDateShortFormat') &&
			!configuration.changed(e, 'defaultDateSource') &&
			!configuration.changed(e, 'defaultDateStyle') &&
			!configuration.changed(e, 'defaultGravatarsStyle') &&
			!configuration.changed(e, 'defaultTimeFormat')
		) {
			return false;
		}

		return true;
	}

	async findCommit(commit: GitLogCommit | { repoPath: string; ref: string }, token?: CancellationToken) {
		const repoNodeId = RepositoryNode.getId(commit.repoPath);

		const branch = await Container.git.getBranch(commit.repoPath);
		if (branch == null) return undefined;

		// Check if the commit exists on the current branch
		if (!(await Container.git.branchContainsCommit(commit.repoPath, branch.name, commit.ref))) return undefined;

		return this.findNode((n: any) => n.commit?.ref === commit.ref, {
			allowPaging: true,
			maxDepth: 2,
			canTraverse: async n => {
				if (n instanceof CommitsViewNode) {
					let node: ViewNode | undefined = await n.getSplattedChild?.();
					if (node instanceof CommitsRepositoryNode) {
						node = await node.getSplattedChild?.();
						if (node instanceof BranchNode) {
							await node.loadMore({ until: commit.ref });
						}
					}

					return true;
				}

				if (n instanceof CommitsRepositoryNode) {
					if (n.id.startsWith(repoNodeId)) {
						const node = await n.getSplattedChild?.();
						if (node instanceof BranchNode) {
							await node.loadMore({ until: commit.ref });
							return true;
						}
					}
				}

				if (n instanceof BranchTrackingStatusNode) {
					return n.id.startsWith(repoNodeId);
				}

				return false;
			},
			token: token,
		});
	}

	@gate(() => '')
	async revealCommit(
		commit: GitRevisionReference,
		options?: {
			select?: boolean;
			focus?: boolean;
			expand?: boolean | number;
		},
	) {
		return window.withProgress(
			{
				location: ProgressLocation.Notification,
				title: `Revealing ${GitReference.toString(commit, { icon: false })} in the side bar...`,
				cancellable: true,
			},
			async (progress, token) => {
				const node = await this.findCommit(commit, token);
				if (node == null) return undefined;

				await this.ensureRevealNode(node, options);

				return node;
			},
		);
	}

	private setFilesLayout(layout: ViewFilesLayout) {
		return configuration.updateEffective('views', this.configKey, 'files', 'layout', layout);
	}

	private setMyCommitsOnly(enabled: boolean) {
		void setContext(ContextKeys.ViewsCommitsMyCommitsOnly, enabled);
		this.state.myCommitsOnly = enabled;
		void this.refresh(true);
	}

	private setShowAvatars(enabled: boolean) {
		return configuration.updateEffective('views', this.configKey, 'avatars', enabled);
	}

	private setShowBranchComparison(enabled: boolean) {
		return configuration.updateEffective(
			'views',
			this.configKey,
			'showBranchComparison',
			enabled ? ViewShowBranchComparison.Working : false,
		);
	}

	private async setShowBranchPullRequest(enabled: boolean) {
		await configuration.updateEffective('views', this.configKey, 'pullRequests', 'showForBranches', enabled);
		await configuration.updateEffective('views', this.configKey, 'pullRequests', 'enabled', enabled);
	}
}
