import { LivechatUnit, LivechatDepartmentAgents } from '@rocket.chat/models';
import type { ServerMethods } from '@rocket.chat/ui-contexts';
import mem from 'mem';
import { Meteor } from 'meteor/meteor';

import { hasAnyRoleAsync } from '../../../../../app/authorization/server/functions/hasRole';
import { logger } from '../lib/logger';

async function getUnitsFromUserRoles(user: string): Promise<string[]> {
	return LivechatUnit.findByMonitorId(user);
}

async function getDepartmentsFromUserRoles(user: string): Promise<string[]> {
	return (await LivechatDepartmentAgents.findByAgentId(user).toArray()).map((department) => department.departmentId);
}

const memoizedGetUnitFromUserRoles = mem(getUnitsFromUserRoles, { maxAge: 10000 });
const memoizedGetDepartmentsFromUserRoles = mem(getDepartmentsFromUserRoles, { maxAge: 5000 });

export const getUnitsFromUser = async (user: string): Promise<string[] | undefined> => {
	if (!user || (await hasAnyRoleAsync(user, ['admin', 'livechat-manager']))) {
		return;
	}

	if (!(await hasAnyRoleAsync(user, ['livechat-monitor']))) {
		return;
	}

	const unitsAndDepartments = [...(await memoizedGetUnitFromUserRoles(user)), ...(await memoizedGetDepartmentsFromUserRoles(user))];
	logger.debug({ msg: 'Calculating units for monitor', user, unitsAndDepartments });

	return unitsAndDepartments;
};

declare module '@rocket.chat/ui-contexts' {
	// eslint-disable-next-line @typescript-eslint/naming-convention
	interface ServerMethods {
		'livechat:getUnitsFromUser'(): Promise<string[] | undefined>;
	}
}

Meteor.methods<ServerMethods>({
	async 'livechat:getUnitsFromUser'(): Promise<string[] | undefined> {
		const user = Meteor.userId();
		if (!user) {
			return;
		}
		return getUnitsFromUser(user);
	},
});
