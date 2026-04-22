// src/settings/2_x_x_Migrations/index.ts

/**
 * A complete end-to-end migration code for smooth migration from the older version Task Board series, 1.x.x to a new version series 2.x.x.
 * NOTE : This migration may only work properly when migrating from the latest version from 1.x.x series, which is 1.10.2 to the first version of the 2.x.x series, which is 2.0.0.
 *
 * @see https://tu2-atmanand.github.io/task-board-docs/docs/Migrating_To_2.x.x/
 * @module settings/2_x_x_Migrations
 * @requires src/settings/2_x_x_Migrations/MigrationUtils
 * @requires src/settings/2_x_x_Migrations/MigrationModal
 * 
 * @description This is a temporary code, which is only required for the next 6 months after the official release of the first version of Task Board's 2.x.x series.
 * We may not have to keep it after that, hence this whole module can be deleted after that. We have dedicated migration architecture for plugin settings (data.json) and for individual board file (*.taskboard) in the respective modules/folders.
 */

import { MigrationModal } from "./MigrationModal";
import {
	checkForV1Data,
	createBackupConfigFile,
	createBoardFiles,
	migrateMapViewData,
	updateRegistryAndSettings,
	migrateVersion1_to_Version2,
} from "./MigrationUtils";

export {
	MigrationModal,
	checkForV1Data,
	createBackupConfigFile,
	createBoardFiles,
	migrateMapViewData,
	updateRegistryAndSettings,
	migrateVersion1_to_Version2,
};
