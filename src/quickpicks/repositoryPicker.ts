'use strict';
import { Disposable, window } from 'vscode';
import { Container } from '../container';
import { Repository } from '../git/git';
import { getQuickPickIgnoreFocusOut, RepositoryQuickPickItem } from '../quickpicks';
import { Iterables } from '../system';

export namespace RepositoryPicker {
	export async function show(
		title: string | undefined,
		placeholder: string = 'Choose a repository',
		repositories?: Repository[],
	): Promise<RepositoryQuickPickItem | undefined> {
		const items: RepositoryQuickPickItem[] = await Promise.all([
			...Iterables.map(repositories ?? (await Container.git.getOrderedRepositories()), r =>
				RepositoryQuickPickItem.create(r, undefined, { branch: true, status: true }),
			),
		]);

		const quickpick = window.createQuickPick<RepositoryQuickPickItem>();
		quickpick.ignoreFocusOut = getQuickPickIgnoreFocusOut();

		const disposables: Disposable[] = [];

		try {
			const pick = await new Promise<RepositoryQuickPickItem | undefined>(resolve => {
				disposables.push(
					quickpick.onDidHide(() => resolve(undefined)),
					quickpick.onDidAccept(() => {
						if (quickpick.activeItems.length !== 0) {
							resolve(quickpick.activeItems[0]);
						}
					}),
				);

				quickpick.title = title;
				quickpick.placeholder = placeholder;
				quickpick.matchOnDescription = true;
				quickpick.matchOnDetail = true;
				quickpick.items = items;

				quickpick.show();
			});
			if (pick == null) return undefined;

			return pick;
		} finally {
			quickpick.dispose();
			disposables.forEach(d => d.dispose());
		}
	}
}
