'use strict';
import {
	CancellationToken,
	commands,
	ConfigurationChangeEvent,
	Event,
	EventEmitter,
	ProgressLocation,
	window,
} from 'vscode';
import {
	configuration,
	RepositoriesViewConfig,
	ViewBranchesLayout,
	ViewFilesLayout,
	ViewShowBranchComparison,
} from '../configuration';
import { ContextKeys, setContext, WorkspaceState } from '../constants';
import { Container } from '../container';
import {
	GitBranch,
	GitBranchReference,
	GitLogCommit,
	GitReference,
	GitRevisionReference,
	GitStashReference,
	GitTagReference,
} from '../git/git';
import {
	BranchesNode,
	BranchNode,
	BranchOrTagFolderNode,
	BranchTrackingStatusNode,
	CompareBranchNode,
	ContributorsNode,
	ReflogNode,
	RemoteNode,
	RemotesNode,
	RepositoriesNode,
	RepositoryNode,
	StashesNode,
	StashNode,
	TagsNode,
} from './nodes';
import { gate } from '../system';
import { ViewBase } from './viewBase';

export class RepositoriesView extends ViewBase<RepositoriesNode, RepositoriesViewConfig> {
	protected readonly configKey = 'repositories';

	constructor() {
		super('gitlens.views.repositories', 'Repositories');
	}

	private _onDidChangeAutoRefresh = new EventEmitter<void>();
	get onDidChangeAutoRefresh(): Event<void> {
		return this._onDidChangeAutoRefresh.event;
	}

	getRoot() {
		return new RepositoriesNode(this);
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
				await Container.git.resetCaches('branches', 'contributors', 'remotes', 'stashes', 'status', 'tags');
				return this.refresh(true);
			},
			this,
		);
		commands.registerCommand(
			this.getQualifiedCommand('setBranchesLayoutToList'),
			() => this.setBranchesLayout(ViewBranchesLayout.List),
			this,
		);
		commands.registerCommand(
			this.getQualifiedCommand('setBranchesLayoutToTree'),
			() => this.setBranchesLayout(ViewBranchesLayout.Tree),
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
			this.getQualifiedCommand('setAutoRefreshToOn'),
			() => this.setAutoRefresh(Container.config.views.repositories.autoRefresh, true),
			this,
		);
		commands.registerCommand(
			this.getQualifiedCommand('setAutoRefreshToOff'),
			() => this.setAutoRefresh(Container.config.views.repositories.autoRefresh, false),
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
			this.getQualifiedCommand('setBranchesShowBranchComparisonOn'),
			() => this.setBranchShowBranchComparison(true),
			this,
		);
		commands.registerCommand(
			this.getQualifiedCommand('setBranchesShowBranchComparisonOff'),
			() => this.setBranchShowBranchComparison(false),
			this,
		);

		commands.registerCommand(
			this.getQualifiedCommand('setShowBranchesOn'),
			() => this.toggleSection('showBranches', true),
			this,
		);
		commands.registerCommand(
			this.getQualifiedCommand('setShowBranchesOff'),
			() => this.toggleSection('showBranches', false),
			this,
		);

		commands.registerCommand(
			this.getQualifiedCommand('setShowCommitsOn'),
			() => this.toggleSection('showCommits', true),
			this,
		);
		commands.registerCommand(
			this.getQualifiedCommand('setShowCommitsOff'),
			() => this.toggleSection('showCommits', false),
			this,
		);

		commands.registerCommand(
			this.getQualifiedCommand('setShowContributorsOn'),
			() => this.toggleSection('showContributors', true),
			this,
		);
		commands.registerCommand(
			this.getQualifiedCommand('setShowContributorsOff'),
			() => this.toggleSection('showContributors', false),
			this,
		);

		commands.registerCommand(
			this.getQualifiedCommand('setShowRemotesOn'),
			() => this.toggleSection('showRemotes', true),
			this,
		);
		commands.registerCommand(
			this.getQualifiedCommand('setShowRemotesOff'),
			() => this.toggleSection('showRemotes', false),
			this,
		);

		commands.registerCommand(
			this.getQualifiedCommand('setShowStashesOn'),
			() => this.toggleSection('showStashes', true),
			this,
		);
		commands.registerCommand(
			this.getQualifiedCommand('setShowStashesOff'),
			() => this.toggleSection('showStashes', false),
			this,
		);

		commands.registerCommand(
			this.getQualifiedCommand('setShowTagsOn'),
			() => this.toggleSection('showTags', true),
			this,
		);
		commands.registerCommand(
			this.getQualifiedCommand('setShowTagsOff'),
			() => this.toggleSection('showTags', false),
			this,
		);

		commands.registerCommand(
			this.getQualifiedCommand('setShowUpstreamStatusOn'),
			() => this.toggleSection('showUpstreamStatus', true),
			this,
		);
		commands.registerCommand(
			this.getQualifiedCommand('setShowUpstreamStatusOff'),
			() => this.toggleSection('showUpstreamStatus', false),
			this,
		);

		commands.registerCommand(
			this.getQualifiedCommand('setShowSectionOff'),
			(
				node:
					| BranchesNode
					| BranchNode
					| BranchTrackingStatusNode
					| CompareBranchNode
					| ContributorsNode
					| ReflogNode
					| RemotesNode
					| StashesNode
					| TagsNode,
			) => this.toggleSectionByNode(node, false),
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
			!configuration.changed(e, 'defaultTimeFormat') &&
			!configuration.changed(e, 'sortBranchesBy') &&
			!configuration.changed(e, 'sortTagsBy')
		) {
			return false;
		}

		return true;
	}
	protected onConfigurationChanged(e: ConfigurationChangeEvent) {
		if (configuration.changed(e, 'views', this.configKey, 'autoRefresh')) {
			void this.setAutoRefresh(Container.config.views.repositories.autoRefresh);
		}

		super.onConfigurationChanged(e);
	}

	get autoRefresh() {
		return (
			this.config.autoRefresh &&
			Container.context.workspaceState.get<boolean>(WorkspaceState.ViewsRepositoriesAutoRefresh, true)
		);
	}

	findBranch(branch: GitBranchReference, token?: CancellationToken) {
		const repoNodeId = RepositoryNode.getId(branch.repoPath);

		if (branch.remote) {
			return this.findNode((n: any) => n.branch !== undefined && n.branch.ref === branch.ref, {
				allowPaging: true,
				maxDepth: 6,
				canTraverse: n => {
					// Only search for branch nodes in the same repo within BranchesNode
					if (n instanceof RepositoriesNode) return true;

					if (n instanceof RemoteNode) {
						if (!n.id.startsWith(repoNodeId)) return false;

						return branch.remote && n.remote.name === GitBranch.getRemote(branch.name); //branch.getRemoteName();
					}

					if (
						n instanceof RepositoryNode ||
						n instanceof BranchesNode ||
						n instanceof RemotesNode ||
						n instanceof BranchOrTagFolderNode
					) {
						return n.id.startsWith(repoNodeId);
					}

					return false;
				},
				token: token,
			});
		}

		return this.findNode((n: any) => n.branch !== undefined && n.branch.ref === branch.ref, {
			allowPaging: true,
			maxDepth: 5,
			canTraverse: n => {
				// Only search for branch nodes in the same repo within BranchesNode
				if (n instanceof RepositoriesNode) return true;

				if (n instanceof RepositoryNode || n instanceof BranchesNode || n instanceof BranchOrTagFolderNode) {
					return n.id.startsWith(repoNodeId);
				}

				return false;
			},
			token: token,
		});
	}

	async findCommit(commit: GitLogCommit | { repoPath: string; ref: string }, token?: CancellationToken) {
		const repoNodeId = RepositoryNode.getId(commit.repoPath);

		// Get all the branches the commit is on
		let branches = await Container.git.getCommitBranches(commit.repoPath, commit.ref);
		if (branches.length !== 0) {
			return this.findNode((n: any) => n.commit !== undefined && n.commit.ref === commit.ref, {
				allowPaging: true,
				maxDepth: 6,
				canTraverse: async n => {
					// Only search for commit nodes in the same repo within BranchNodes
					if (n instanceof RepositoriesNode) return true;

					if (n instanceof BranchNode) {
						if (n.id.startsWith(repoNodeId) && branches.includes(n.branch.name)) {
							await n.loadMore({ until: commit.ref });
							return true;
						}
					}

					if (
						n instanceof RepositoryNode ||
						n instanceof BranchesNode ||
						n instanceof BranchOrTagFolderNode
					) {
						return n.id.startsWith(repoNodeId);
					}

					return false;
				},
				token: token,
			});
		}

		// If we didn't find the commit on any local branches, check remote branches
		branches = await Container.git.getCommitBranches(commit.repoPath, commit.ref, { remotes: true });
		if (branches.length === 0) return undefined;

		const remotes = branches.map(b => b.split('/', 1)[0]);

		return this.findNode((n: any) => n.commit !== undefined && n.commit.ref === commit.ref, {
			allowPaging: true,
			maxDepth: 8,
			canTraverse: n => {
				// Only search for commit nodes in the same repo within BranchNodes
				if (n instanceof RepositoriesNode) return true;

				if (n instanceof RemoteNode) {
					return n.id.startsWith(repoNodeId) && remotes.includes(n.remote.name);
				}

				if (n instanceof BranchNode) {
					return n.id.startsWith(repoNodeId) && branches.includes(n.branch.name);
				}

				if (n instanceof RepositoryNode || n instanceof RemotesNode || n instanceof BranchOrTagFolderNode) {
					return n.id.startsWith(repoNodeId);
				}

				return false;
			},
			token: token,
		});
	}

	findStash(stash: GitStashReference, token?: CancellationToken) {
		const repoNodeId = RepositoryNode.getId(stash.repoPath);

		return this.findNode(StashNode.getId(stash.repoPath, stash.ref), {
			maxDepth: 3,
			canTraverse: n => {
				// Only search for stash nodes in the same repo within a StashesNode
				if (n instanceof RepositoriesNode) return true;

				if (n instanceof RepositoryNode || n instanceof StashesNode) {
					return n.id.startsWith(repoNodeId);
				}

				return false;
			},
			token: token,
		});
	}

	findTag(tag: GitTagReference, token?: CancellationToken) {
		const repoNodeId = RepositoryNode.getId(tag.repoPath);

		return this.findNode((n: any) => n.tag !== undefined && n.tag.ref === tag.ref, {
			allowPaging: true,
			maxDepth: 5,
			canTraverse: n => {
				// Only search for tag nodes in the same repo within TagsNode
				if (n instanceof RepositoriesNode) return true;

				if (n instanceof RepositoryNode || n instanceof TagsNode || n instanceof BranchOrTagFolderNode) {
					return n.id.startsWith(repoNodeId);
				}

				return false;
			},
			token: token,
		});
	}

	@gate(() => '')
	revealBranch(
		branch: GitBranchReference,
		options?: {
			select?: boolean;
			focus?: boolean;
			expand?: boolean | number;
		},
	) {
		return window.withProgress(
			{
				location: ProgressLocation.Notification,
				title: `Revealing ${GitReference.toString(branch, { icon: false })} in the Repositories view...`,
				cancellable: true,
			},
			async (progress, token) => {
				const node = await this.findBranch(branch, token);
				if (node == null) return undefined;

				await this.ensureRevealNode(node, options);

				return node;
			},
		);
	}

	@gate(() => '')
	async revealBranches(
		repoPath: string,
		options?: {
			select?: boolean;
			focus?: boolean;
			expand?: boolean | number;
		},
	) {
		const repoNodeId = RepositoryNode.getId(repoPath);

		const node = await this.findNode(BranchesNode.getId(repoPath), {
			maxDepth: 2,
			canTraverse: n => {
				// Only search for branches nodes in the same repo
				if (n instanceof RepositoriesNode) return true;

				if (n instanceof RepositoryNode) {
					return n.id.startsWith(repoNodeId);
				}

				return false;
			},
		});

		if (node !== undefined) {
			await this.reveal(node, options);
		}

		return node;
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
				title: `Revealing ${GitReference.toString(commit, { icon: false })} in the Repositories view...`,
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

	@gate(() => '')
	async revealRepository(
		repoPath: string,
		options?: {
			select?: boolean;
			focus?: boolean;
			expand?: boolean | number;
		},
	) {
		const repoNodeId = RepositoryNode.getId(repoPath);

		const node = await this.findNode(repoNodeId, {
			maxDepth: 1,
			canTraverse: n => {
				// Only search for branches nodes in the same repo
				if (n instanceof RepositoriesNode) return true;

				// if (n instanceof RepositoryNode) {
				// 	return n.id.startsWith(repoNodeId);
				// }

				return false;
			},
		});

		if (node !== undefined) {
			await this.reveal(node, options);
		}

		return node;
	}

	@gate(() => '')
	async revealStash(
		stash: GitStashReference,
		options?: {
			select?: boolean;
			focus?: boolean;
			expand?: boolean | number;
		},
	) {
		return window.withProgress(
			{
				location: ProgressLocation.Notification,
				title: `Revealing ${GitReference.toString(stash, { icon: false })} in the Repositories view...`,
				cancellable: true,
			},
			async (progress, token) => {
				const node = await this.findStash(stash, token);
				if (node !== undefined) {
					await this.reveal(node, options);
				}

				return node;
			},
		);
	}

	@gate(() => '')
	async revealStashes(
		repoPath: string,
		options?: {
			select?: boolean;
			focus?: boolean;
			expand?: boolean | number;
		},
	) {
		const repoNodeId = RepositoryNode.getId(repoPath);

		const node = await this.findNode(StashesNode.getId(repoPath), {
			maxDepth: 2,
			canTraverse: n => {
				// Only search for stashes nodes in the same repo
				if (n instanceof RepositoriesNode) return true;

				if (n instanceof RepositoryNode) {
					return n.id.startsWith(repoNodeId);
				}

				return false;
			},
		});

		if (node !== undefined) {
			await this.reveal(node, options);
		}

		return node;
	}

	@gate(() => '')
	revealTag(
		tag: GitTagReference,
		options?: {
			select?: boolean;
			focus?: boolean;
			expand?: boolean | number;
		},
	) {
		return window.withProgress(
			{
				location: ProgressLocation.Notification,
				title: `Revealing ${GitReference.toString(tag, { icon: false })} in the Repositories view...`,
				cancellable: true,
			},
			async (progress, token) => {
				const node = await this.findTag(tag, token);
				if (node == null) return undefined;

				await this.ensureRevealNode(node, options);

				return node;
			},
		);
	}

	@gate(() => '')
	async revealTags(
		repoPath: string,
		options?: {
			select?: boolean;
			focus?: boolean;
			expand?: boolean | number;
		},
	) {
		const repoNodeId = RepositoryNode.getId(repoPath);

		const node = await this.findNode(TagsNode.getId(repoPath), {
			maxDepth: 2,
			canTraverse: n => {
				// Only search for tags nodes in the same repo
				if (n instanceof RepositoriesNode) return true;

				if (n instanceof RepositoryNode) {
					return n.id.startsWith(repoNodeId);
				}

				return false;
			},
		});

		if (node !== undefined) {
			await this.reveal(node, options);
		}

		return node;
	}

	private async setAutoRefresh(enabled: boolean, workspaceEnabled?: boolean) {
		if (enabled) {
			if (workspaceEnabled === undefined) {
				workspaceEnabled = Container.context.workspaceState.get<boolean>(
					WorkspaceState.ViewsRepositoriesAutoRefresh,
					true,
				);
			} else {
				await Container.context.workspaceState.update(
					WorkspaceState.ViewsRepositoriesAutoRefresh,
					workspaceEnabled,
				);
			}
		}

		void setContext(ContextKeys.ViewsRepositoriesAutoRefresh, enabled && workspaceEnabled);

		this._onDidChangeAutoRefresh.fire();
	}

	private setBranchesLayout(layout: ViewBranchesLayout) {
		return configuration.updateEffective('views', this.configKey, 'branches', 'layout', layout);
	}

	private setFilesLayout(layout: ViewFilesLayout) {
		return configuration.updateEffective('views', this.configKey, 'files', 'layout', layout);
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

	private setBranchShowBranchComparison(enabled: boolean) {
		return configuration.updateEffective(
			'views',
			this.configKey,
			'branches',
			'showBranchComparison',
			enabled ? ViewShowBranchComparison.Branch : false,
		);
	}

	toggleSection(
		key:
			| 'showBranches'
			| 'showCommits'
			| 'showContributors'
			// | 'showIncomingActivity'
			| 'showRemotes'
			| 'showStashes'
			| 'showTags'
			| 'showUpstreamStatus',
		enabled: boolean,
	) {
		return configuration.updateEffective('views', this.configKey, key, enabled);
	}

	toggleSectionByNode(
		node:
			| BranchesNode
			| BranchNode
			| BranchTrackingStatusNode
			| CompareBranchNode
			| ContributorsNode
			| ReflogNode
			| RemotesNode
			| StashesNode
			| TagsNode,
		enabled: boolean,
	) {
		if (node instanceof BranchesNode) {
			return configuration.updateEffective('views', this.configKey, 'showBranches', enabled);
		}

		if (node instanceof BranchNode) {
			return configuration.updateEffective('views', this.configKey, 'showCommits', enabled);
		}

		if (node instanceof BranchTrackingStatusNode) {
			return configuration.updateEffective('views', this.configKey, 'showUpstreamStatus', enabled);
		}

		if (node instanceof CompareBranchNode) {
			return this.setShowBranchComparison(enabled);
		}

		if (node instanceof ContributorsNode) {
			return configuration.updateEffective('views', this.configKey, 'showContributors', enabled);
		}

		if (node instanceof ReflogNode) {
			return configuration.updateEffective('views', this.configKey, 'showIncomingActivity', enabled);
		}

		if (node instanceof RemotesNode) {
			return configuration.updateEffective('views', this.configKey, 'showRemotes', enabled);
		}

		if (node instanceof StashesNode) {
			return configuration.updateEffective('views', this.configKey, 'showStashes', enabled);
		}

		if (node instanceof TagsNode) {
			return configuration.updateEffective('views', this.configKey, 'showTags', enabled);
		}

		return Promise.resolve();
	}
}
