'use strict';
import { ThemeIcon, TreeItem, TreeItemCollapsibleState } from 'vscode';
import { BranchesView } from '../branchesView';
import { BranchNode } from './branchNode';
import { BranchOrTagFolderNode } from './branchOrTagFolderNode';
import { MessageNode } from './common';
import { ViewBranchesLayout } from '../../configuration';
import { Repository } from '../../git/git';
import { GitUri } from '../../git/gitUri';
import { RepositoriesView } from '../repositoriesView';
import { RepositoryNode } from './repositoryNode';
import { Arrays, debug, gate } from '../../system';
import { ContextValues, ViewNode } from './viewNode';

export class BranchesNode extends ViewNode<BranchesView | RepositoriesView> {
	static key = ':branches';
	static getId(repoPath: string): string {
		return `${RepositoryNode.getId(repoPath)}${this.key}`;
	}

	private _children: ViewNode[] | undefined;

	constructor(
		uri: GitUri,
		view: BranchesView | RepositoriesView,
		parent: ViewNode,
		public readonly repo: Repository,
	) {
		super(uri, view, parent);
	}

	get id(): string {
		return BranchesNode.getId(this.repo.path);
	}

	get repoPath(): string {
		return this.repo.path;
	}

	async getChildren(): Promise<ViewNode[]> {
		if (this._children == null) {
			const branches = await this.repo.getBranches({
				// only show local branches
				filter: b => !b.remote,
				sort: { current: false },
			});
			if (branches.length === 0) return [new MessageNode(this.view, this, 'No branches could be found.')];

			const branchNodes = branches.map(
				b =>
					new BranchNode(GitUri.fromRepoPath(this.uri.repoPath!, b.ref), this.view, this, b, false, {
						showComparison:
							this.view instanceof RepositoriesView
								? this.view.config.branches.showBranchComparison
								: this.view.config.showBranchComparison,
					}),
			);
			if (this.view.config.branches.layout === ViewBranchesLayout.List) return branchNodes;

			const hierarchy = Arrays.makeHierarchical(
				branchNodes,
				n => n.treeHierarchy,
				(...paths) => paths.join('/'),
				this.view.config.files.compact,
				b => {
					b.compacted = true;
					return true;
				},
			);

			const root = new BranchOrTagFolderNode(
				this.view,
				this,
				'branch',
				this.repo.path,
				'',
				undefined,
				hierarchy,
				'branches',
			);
			this._children = root.getChildren();
		}

		return this._children;
	}

	async getTreeItem(): Promise<TreeItem> {
		const item = new TreeItem('Branches', TreeItemCollapsibleState.Collapsed);
		item.contextValue = ContextValues.Branches;
		if (await this.repo.hasRemotes()) {
			item.contextValue += '+remotes';
		}
		item.iconPath = new ThemeIcon('git-branch');
		item.id = this.id;

		return item;
	}

	@gate()
	@debug()
	refresh() {
		this._children = undefined;
	}
}
