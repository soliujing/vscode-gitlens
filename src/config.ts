'use strict';

export enum TraceLevel {
	Silent = 'silent',
	Errors = 'errors',
	Verbose = 'verbose',
	Debug = 'debug',
}

export interface Config {
	autolinks: AutolinkReference[] | null;
	blame: {
		avatars: boolean;
		compact: boolean;
		dateFormat: string | null;
		format: string;
		heatmap: {
			enabled: boolean;
			location: 'left' | 'right';
		};
		highlight: {
			enabled: boolean;
			locations: BlameHighlightLocations[];
		};
		ignoreWhitespace: boolean;
		separateLines: boolean;
		toggleMode: AnnotationsToggleMode;
	};
	changes: {
		locations: ChangesLocations[];
		toggleMode: AnnotationsToggleMode;
	};
	codeLens: CodeLensConfig;
	currentLine: {
		dateFormat: string | null;
		enabled: boolean;
		format: string;
		pullRequests: {
			enabled: boolean;
		};
		scrollable: boolean;
	};
	debug: boolean;
	defaultDateFormat: string | null;
	defaultDateShortFormat: string | null;
	defaultDateSource: DateSource;
	defaultDateStyle: DateStyle;
	defaultGravatarsStyle: GravatarDefaultStyle;
	defaultTimeFormat: string | null;
	fileAnnotations: {
		command: string | null;
	};
	gitCommands: {
		closeOnFocusOut: boolean;
		search: {
			matchAll: boolean;
			matchCase: boolean;
			matchRegex: boolean;
			showResultsInSideBar: boolean | null;
		};
		skipConfirmations: string[];
		sortBy: GitCommandSorting;
	};
	heatmap: {
		ageThreshold: number;
		coldColor: string;
		hotColor: string;
		locations: HeatmapLocations[];
		toggleMode: AnnotationsToggleMode;
	};
	hovers: {
		annotations: {
			changes: boolean;
			details: boolean;
			enabled: boolean;
			over: 'line' | 'annotation';
		};
		autolinks: {
			enabled: boolean;
			enhanced: boolean;
		};
		currentLine: {
			changes: boolean;
			details: boolean;
			enabled: boolean;
			over: 'line' | 'annotation';
		};
		avatars: boolean;
		avatarSize: number;
		changesDiff: 'line' | 'hunk';
		detailsMarkdownFormat: string;
		enabled: boolean;
		pullRequests: {
			enabled: boolean;
		};
	};
	integrations: {
		enabled: boolean;
	};
	keymap: KeyMap;
	liveshare: {
		allowGuestAccess: boolean;
	};
	menus: boolean | MenuConfig;
	mode: {
		active: string;
		statusBar: {
			enabled: boolean;
			alignment: 'left' | 'right';
		};
	};
	modes: Record<string, ModeConfig>;
	outputLevel: TraceLevel;
	remotes: RemotesConfig[] | null;
	showWelcomeOnInstall: boolean;
	showWhatsNewAfterUpgrades: boolean;
	sortBranchesBy: BranchSorting;
	sortTagsBy: TagSorting;
	statusBar: {
		alignment: 'left' | 'right';
		command: StatusBarCommand;
		dateFormat: string | null;
		enabled: boolean;
		format: string;
		reduceFlicker: boolean;
		pullRequests: {
			enabled: boolean;
		};
	};
	strings: {
		codeLens: {
			unsavedChanges: {
				recentChangeAndAuthors: string;
				recentChangeOnly: string;
				authorsOnly: string;
			};
		};
	};
	terminalLinks: {
		enabled: boolean;
	};
	views: ViewsConfig;
	advanced: AdvancedConfig;
}

export enum AnnotationsToggleMode {
	File = 'file',
	Window = 'window',
}

export interface AutolinkReference {
	prefix: string;
	url: string;
	title?: string;
	alphanumeric?: boolean;
	ignoreCase?: boolean;
}

export enum BlameHighlightLocations {
	Gutter = 'gutter',
	Line = 'line',
	Overview = 'overview',
}

export enum BranchSorting {
	NameDesc = 'name:desc',
	NameAsc = 'name:asc',
	DateDesc = 'date:desc',
	DateAsc = 'date:asc',
}

export enum ChangesLocations {
	Gutter = 'gutter',
	Overview = 'overview',
}

export enum CodeLensCommand {
	DiffWithPrevious = 'gitlens.diffWithPrevious',
	RevealCommitInView = 'gitlens.revealCommitInView',
	ShowCommitsInView = 'gitlens.showCommitsInView',
	ShowQuickCommitDetails = 'gitlens.showQuickCommitDetails',
	ShowQuickCommitFileDetails = 'gitlens.showQuickCommitFileDetails',
	ShowQuickCurrentBranchHistory = 'gitlens.showQuickRepoHistory',
	ShowQuickFileHistory = 'gitlens.showQuickFileHistory',
	ToggleFileBlame = 'gitlens.toggleFileBlame',
}

export enum CodeLensScopes {
	Document = 'document',
	Containers = 'containers',
	Blocks = 'blocks',
}

export enum CustomRemoteType {
	Bitbucket = 'Bitbucket',
	BitbucketServer = 'BitbucketServer',
	Custom = 'Custom',
	GitHub = 'GitHub',
	GitLab = 'GitLab',
}

export enum DateSource {
	Authored = 'authored',
	Committed = 'committed',
}

export enum DateStyle {
	Absolute = 'absolute',
	Relative = 'relative',
}

export enum FileAnnotationType {
	Blame = 'blame',
	Changes = 'changes',
	Heatmap = 'heatmap',
}

export enum GitCommandSorting {
	Name = 'name',
	Usage = 'usage',
}

export enum GravatarDefaultStyle {
	Faces = 'wavatar',
	Geometric = 'identicon',
	Monster = 'monsterid',
	MysteryPerson = 'mp',
	Retro = 'retro',
	Robot = 'robohash',
}

export enum HeatmapLocations {
	Gutter = 'gutter',
	Overview = 'overview',
}

export enum KeyMap {
	Alternate = 'alternate',
	Chorded = 'chorded',
	None = 'none',
}

export enum StatusBarCommand {
	DiffWithPrevious = 'gitlens.diffWithPrevious',
	DiffWithWorking = 'gitlens.diffWithWorking',
	RevealCommitInView = 'gitlens.revealCommitInView',
	ShowCommitsInView = 'gitlens.showCommitsInView',
	ShowQuickCommitDetails = 'gitlens.showQuickCommitDetails',
	ShowQuickCommitFileDetails = 'gitlens.showQuickCommitFileDetails',
	ShowQuickCurrentBranchHistory = 'gitlens.showQuickRepoHistory',
	ShowQuickFileHistory = 'gitlens.showQuickFileHistory',
	ToggleCodeLens = 'gitlens.toggleCodeLens',
	ToggleFileBlame = 'gitlens.toggleFileBlame',
}

export enum TagSorting {
	NameDesc = 'name:desc',
	NameAsc = 'name:asc',
	DateDesc = 'date:desc',
	DateAsc = 'date:asc',
}

export enum ViewBranchesLayout {
	List = 'list',
	Tree = 'tree',
}

export enum ViewFilesLayout {
	Auto = 'auto',
	List = 'list',
	Tree = 'tree',
}

export enum ViewShowBranchComparison {
	Branch = 'branch',
	Working = 'working',
}

export interface AdvancedConfig {
	abbreviatedShaLength: number;
	abbreviateShaOnCopy: boolean;
	blame: {
		customArguments: string[] | null;
		delayAfterEdit: number;
		sizeThresholdAfterEdit: number;
	};
	caching: {
		enabled: boolean;
	};
	fileHistoryFollowsRenames: boolean;
	fileHistoryShowAllBranches: boolean;
	maxListItems: number;
	maxSearchItems: number;
	messages: {
		suppressCommitHasNoPreviousCommitWarning: boolean;
		suppressCommitNotFoundWarning: boolean;
		suppressFileNotUnderSourceControlWarning: boolean;
		suppressGitDisabledWarning: boolean;
		suppressGitVersionWarning: boolean;
		suppressLineUncommittedWarning: boolean;
		suppressNoRepositoryWarning: boolean;
		suppressRebaseSwitchToTextWarning: boolean;
	};
	quickPick: {
		closeOnFocusOut: boolean;
	};
	repositorySearchDepth: number;
	similarityThreshold: number | null;
	useSymmetricDifferenceNotation: boolean;
}

export interface CodeLensConfig {
	authors: {
		enabled: boolean;
		command: CodeLensCommand | false;
	};
	enabled: boolean;
	includeSingleLineSymbols: boolean;
	recentChange: {
		enabled: boolean;
		command: CodeLensCommand | false;
	};
	scopes: CodeLensScopes[];
	scopesByLanguage: CodeLensLanguageScope[] | null;
	symbolScopes: string[];
}

export interface CodeLensLanguageScope {
	language: string | undefined;
	scopes?: CodeLensScopes[];
	symbolScopes?: string[];
}

export interface MenuConfig {
	editor:
		| false
		| {
				blame: boolean;
				clipboard: boolean;
				compare: boolean;
				history: boolean;
				remote: boolean;
		  };
	editorGroup:
		| false
		| {
				blame: boolean;
				compare: boolean;
		  };
	editorTab:
		| false
		| {
				clipboard: boolean;
				compare: boolean;
				history: boolean;
				remote: boolean;
		  };
	explorer:
		| false
		| {
				clipboard: boolean;
				compare: boolean;
				history: boolean;
				remote: boolean;
		  };
	scm:
		| false
		| {
				authors: boolean;
		  };
	scmGroupInline:
		| false
		| {
				stash: boolean;
		  };
	scmGroup:
		| false
		| {
				compare: boolean;
				openClose: boolean;
				stash: boolean;
		  };
	scmItem:
		| false
		| {
				clipboard: boolean;
				compare: boolean;
				history: boolean;
				remote: boolean;
				stash: boolean;
		  };
}

export interface ModeConfig {
	name: string;
	statusBarItemName?: string;
	description?: string;
	annotations?: 'blame' | 'changes' | 'heatmap';
	codeLens?: boolean;
	currentLine?: boolean;
	hovers?: boolean;
	statusBar?: boolean;
}

export interface RemotesConfig {
	domain: string;
	name?: string;
	protocol?: string;
	type: CustomRemoteType;
	urls?: RemotesUrlsConfig;
}

export interface RemotesUrlsConfig {
	repository: string;
	branches: string;
	branch: string;
	commit: string;
	comparison?: string;
	file: string;
	fileInBranch: string;
	fileInCommit: string;
	fileLine: string;
	fileRange: string;
}

export interface ViewsCommonConfig {
	defaultItemLimit: number;
	formats: {
		commits: {
			label: string;
			description: string;
		};
		files: {
			label: string;
			description: string;
		};
		stashes: {
			label: string;
			description: string;
		};
	};
	pageItemLimit: number;
	showRelativeDateMarkers: boolean;
}

export const viewsCommonConfigKeys: (keyof ViewsCommonConfig)[] = [
	'defaultItemLimit',
	'formats',
	'pageItemLimit',
	'showRelativeDateMarkers',
];

interface ViewsConfigs {
	branches: BranchesViewConfig;
	commits: CommitsViewConfig;
	contributors: ContributorsViewConfig;
	fileHistory: FileHistoryViewConfig;
	lineHistory: LineHistoryViewConfig;
	remotes: RemotesViewConfig;
	repositories: RepositoriesViewConfig;
	searchAndCompare: SearchAndCompareViewConfig;
	stashes: StashesViewConfig;
	tags: TagsViewConfig;
}

export type ViewsConfigKeys = keyof ViewsConfigs;
export const viewsConfigKeys: ViewsConfigKeys[] = [
	'commits',
	'repositories',
	'fileHistory',
	'lineHistory',
	'branches',
	'remotes',
	'stashes',
	'tags',
	'contributors',
	'searchAndCompare',
];

export type ViewsConfig = ViewsCommonConfig & ViewsConfigs;

export interface BranchesViewConfig {
	avatars: boolean;
	branches: {
		layout: ViewBranchesLayout;
	};
	files: ViewsFilesConfig;
	pullRequests: {
		enabled: boolean;
		showForBranches: boolean;
		showForCommits: boolean;
	};
	showBranchComparison: false | ViewShowBranchComparison.Branch;
}

export interface CommitsViewConfig {
	avatars: boolean;
	branches: undefined;
	files: ViewsFilesConfig;
	pullRequests: {
		enabled: boolean;
		showForBranches: boolean;
		showForCommits: boolean;
	};
	showBranchComparison: false | ViewShowBranchComparison;
}

export interface ContributorsViewConfig {
	avatars: boolean;
	files: ViewsFilesConfig;
	pullRequests: {
		enabled: boolean;
		showForCommits: boolean;
	};
}

export interface FileHistoryViewConfig {
	avatars: boolean;
}

export interface LineHistoryViewConfig {
	avatars: boolean;
	enabled: boolean;
}

export interface RemotesViewConfig {
	avatars: boolean;
	branches: {
		layout: ViewBranchesLayout;
	};
	files: ViewsFilesConfig;
	pullRequests: {
		enabled: boolean;
		showForBranches: boolean;
		showForCommits: boolean;
	};
}

export interface RepositoriesViewConfig {
	autoRefresh: boolean;
	autoReveal: boolean;
	avatars: boolean;
	branches: {
		layout: ViewBranchesLayout;
		showBranchComparison: false | ViewShowBranchComparison.Branch;
	};
	compact: boolean;
	enabled: boolean;
	files: ViewsFilesConfig;
	includeWorkingTree: boolean;
	pullRequests: {
		enabled: boolean;
		showForBranches: boolean;
		showForCommits: boolean;
	};
	showBranchComparison: false | ViewShowBranchComparison;
	showBranches: boolean;
	showCommits: boolean;
	showContributors: boolean;
	showIncomingActivity: boolean;
	showRemotes: boolean;
	showStashes: boolean;
	showTags: boolean;
	showUpstreamStatus: boolean;
}

export interface SearchAndCompareViewConfig {
	avatars: boolean;
	files: ViewsFilesConfig;
	pullRequests: {
		enabled: boolean;
		showForCommits: boolean;
	};
}

export interface StashesViewConfig {
	files: ViewsFilesConfig;
}

export interface TagsViewConfig {
	avatars: boolean;
	branches: {
		layout: ViewBranchesLayout;
	};
	files: ViewsFilesConfig;
}

export interface ViewsFilesConfig {
	compact: boolean;
	layout: ViewFilesLayout;
	threshold: number;
}
