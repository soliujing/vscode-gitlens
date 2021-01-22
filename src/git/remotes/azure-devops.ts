'use strict';
import { Range, Uri } from 'vscode';
import { DynamicAutolinkReference } from '../../annotations/autolinks';
import { AutolinkReference } from '../../config';
import { Repository } from '../models/repository';
import { RemoteProvider } from './provider';

const gitRegex = /\/_git\/?/i;
const legacyDefaultCollectionRegex = /^DefaultCollection\//i;
const orgAndProjectRegex = /^(.*?)\/(.*?)\/(.*)/;
const sshDomainRegex = /^(ssh|vs-ssh)\./i;
const sshPathRegex = /^\/?v\d\//i;

const fileRegex = /path=([^&]+)/i;
const rangeRegex = /line=(\d+)(?:&lineEnd=(\d+))?/;

export class AzureDevOpsRemote extends RemoteProvider {
	constructor(domain: string, path: string, protocol?: string, name?: string, legacy: boolean = false) {
		if (sshDomainRegex.test(domain)) {
			path = path.replace(sshPathRegex, '');
			domain = domain.replace(sshDomainRegex, '');

			// Add in /_git/ into ssh urls
			const match = orgAndProjectRegex.exec(path);
			if (match != null) {
				const [, org, project, rest] = match;

				// Handle legacy vsts urls
				if (legacy) {
					domain = `${org}.${domain}`;
					path = `${project}/_git/${rest}`;
				} else {
					path = `${org}/${project}/_git/${rest}`;
				}
			}
		}

		// Azure DevOps allows projects and repository names with spaces. In that situation,
		// the `path` will be previously encoded during git clone
		// revert that encoding to avoid double-encoding by gitlens during copy remote and open remote
		path = decodeURIComponent(path);
		super(domain, path, protocol, name);
	}

	private _autolinks: (AutolinkReference | DynamicAutolinkReference)[] | undefined;
	get autolinks(): (AutolinkReference | DynamicAutolinkReference)[] {
		if (this._autolinks === undefined) {
			// Strip off any `_git` part from the repo url
			const baseUrl = this.baseUrl.replace(gitRegex, '/');
			this._autolinks = [
				{
					prefix: '#',
					url: `${baseUrl}/_workitems/edit/<num>`,
					title: `Open Work Item #<num> on ${this.name}`,
				},
			];
		}
		return this._autolinks;
	}

	get icon() {
		return 'vsts';
	}

	get id() {
		return 'azure-devops';
	}

	get name() {
		return 'Azure DevOps';
	}

	private _displayPath: string | undefined;
	get displayPath(): string {
		if (this._displayPath === undefined) {
			this._displayPath = this.path.replace(gitRegex, '/').replace(legacyDefaultCollectionRegex, '');
		}
		return this._displayPath;
	}

	async getLocalInfoFromRemoteUri(
		repository: Repository,
		uri: Uri,
		options?: { validate?: boolean },
	): Promise<{ uri: Uri; startLine?: number; endLine?: number } | undefined> {
		if (uri.authority !== this.domain) return Promise.resolve(undefined);
		// if ((options?.validate ?? true) && !uri.path.startsWith(`/${this.path}/`)) return undefined;

		let startLine;
		let endLine;
		if (uri.query) {
			const match = rangeRegex.exec(uri.query);
			if (match != null) {
				const [, start, end] = match;
				if (start) {
					startLine = parseInt(start, 10);
					if (end) {
						endLine = parseInt(end, 10);
					}
				}
			}
		}

		const match = fileRegex.exec(uri.query);
		if (match == null) return Promise.resolve(undefined);

		const [, path] = match;

		const absoluteUri = repository.toAbsoluteUri(path, { validate: options?.validate });
		return Promise.resolve(
			absoluteUri != null ? { uri: absoluteUri, startLine: startLine, endLine: endLine } : undefined,
		);
	}

	protected getUrlForBranches(): string {
		return `${this.baseUrl}/branches`;
	}

	protected getUrlForBranch(branch: string): string {
		return `${this.baseUrl}/?version=GB${branch}&_a=history`;
	}

	protected getUrlForCommit(sha: string): string {
		return `${this.baseUrl}/commit/${sha}`;
	}

	protected getUrlForComparison(ref1: string, ref2: string, _notation: '..' | '...'): string {
		return `${this.baseUrl}/branchCompare?baseVersion=GB${ref1}&targetVersion=GB${ref2}`;
	}

	protected getUrlForFile(fileName: string, branch?: string, sha?: string, range?: Range): string {
		let line;
		if (range != null) {
			if (range.start.line === range.end.line) {
				line = `&line=${range.start.line}`;
			} else {
				line = `&line=${range.start.line}&lineEnd=${range.end.line}`;
			}
		} else {
			line = '';
		}

		if (sha) return `${this.baseUrl}/commit/${sha}/?_a=contents&path=/${fileName}${line}`;
		if (branch) return `${this.baseUrl}/?path=/${fileName}&version=GB${branch}&_a=contents${line}`;
		return `${this.baseUrl}?path=/${fileName}${line}`;
	}
}
