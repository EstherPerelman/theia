/********************************************************************************
 * Copyright (c) 2020 SAP SE or an SAP affiliate company and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * This Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the Eclipse
 * Public License v. 2.0 are satisfied: GNU General Public License, version 2
 * with the GNU Classpath Exception which is available at
 * https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/

import { injectable, inject } from 'inversify';
import { CommandRegistry, CommandContribution, SelectionService } from '@theia/core/lib/common';
import { ApplicationShell, CommonCommands, ConfirmDialog } from '@theia/core/lib/browser';
import { CustomEditorWidget } from './custom-editor-widget';
import { WorkspaceCommands } from '@theia/workspace/lib/browser';
import URI from '@theia/core/lib/common/uri';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { FileDialogService } from '@theia/filesystem/lib/browser';
import { UriAwareCommandHandler } from '@theia/core/lib/common/uri-command-handler';
import { environment } from '@theia/core';
import { MainCustomEditorModel } from './custom-editors-main';

@injectable()
export class CustomEditorContribution implements CommandContribution {

    @inject(ApplicationShell)
    protected readonly shell: ApplicationShell;

    @inject(FileService)
    protected readonly fileService: FileService;

    @inject(FileDialogService)
    protected readonly fileDialogService: FileDialogService;

    @inject(SelectionService)
    protected readonly selectionService: SelectionService;

    registerCommands(commands: CommandRegistry): void {
        commands.registerHandler(CommonCommands.UNDO.id, {
            isEnabled: () => this.shell.activeWidget instanceof CustomEditorWidget
                && this.shell.activeWidget.modelRef.object instanceof MainCustomEditorModel,
            execute: () => (this.shell.activeWidget as CustomEditorWidget).undo(),
        });
        commands.registerHandler(CommonCommands.REDO.id, {
            isEnabled: () => this.shell.activeWidget instanceof CustomEditorWidget
                && this.shell.activeWidget.modelRef.object instanceof MainCustomEditorModel,
            execute: () => (this.shell.activeWidget as CustomEditorWidget).redo(),
        });
        commands.registerHandler(WorkspaceCommands.SAVE_AS.id,
            UriAwareCommandHandler.MonoSelect(this.selectionService, {
                isEnabled: () => this.shell.activeWidget instanceof CustomEditorWidget,
                execute: (uri: URI) => this.saveAs(uri),
            })
        );
    }

    /**
     * Save source `URI` to target.
     *
     * @param uri the source `URI`.
     */
    protected async saveAs(uri: URI): Promise<void> {
        let exist: boolean = false;
        let overwrite: boolean = false;
        let selected: URI | undefined;
        const stat = await this.fileService.resolve(uri);
        do {
            selected = await this.fileDialogService.showSaveDialog(
                {
                    title: WorkspaceCommands.SAVE_AS.label!,
                    filters: {},
                    inputValue: uri.path.base
                }, stat);
            if (selected) {
                exist = await this.fileService.exists(selected);
                if (exist) {
                    overwrite = await this.confirmOverwrite(selected);
                }
            }
        } while (selected && exist && !overwrite);
        if (selected) {
            try {
                await (this.shell.activeWidget as CustomEditorWidget).saveAs(uri, selected, { overwrite });
            } catch (e) {
                console.warn(e);
            }
        }
    }

    private async confirmOverwrite(uri: URI): Promise<boolean> {
        // Electron already handles the confirmation so do not prompt again.
        if (this.isElectron()) {
            return true;
        }
        // Prompt users for confirmation before overwriting.
        const confirmed = await new ConfirmDialog({
            title: 'Overwrite',
            msg: `Do you really want to overwrite "${uri.toString()}"?`
        }).open();
        return !!confirmed;
    }

    private isElectron(): boolean {
        return environment.electron.is();
    }

}
