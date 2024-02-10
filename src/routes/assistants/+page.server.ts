import { base } from "$app/paths";
import { ENABLE_ASSISTANTS } from "$env/static/private";
import { collections } from "$lib/server/database.js";
import type { Assistant } from "$lib/types/Assistant";
import { error, redirect } from "@sveltejs/kit";
import type { Filter } from "mongodb";

const NUM_PER_PAGE = 24;

export const load = async ({ url, locals }) => {
	if (!ENABLE_ASSISTANTS) {
		throw redirect(302, `${base}/`);
	}

	const modelId = url.searchParams.get("modelId");
	const pageIndex = parseInt(url.searchParams.get("p") ?? "0");
	const createdByName = url.searchParams.get("user");
	const createdByCurrentUser = locals.user?.username && locals.user.username === createdByName;

	if (createdByName) {
		const existingUser = await collections.users.findOne({ username: createdByName });
		if (!existingUser) {
			throw error(404, `User "${createdByName}" doesn't exist`);
		}
	}

	// fetch the top assistants sorted by user count from biggest to smallest, filter out all assistants with only 1 users. filter by model too if modelId is provided
	const filter: Filter<Assistant> = {
		modelId: modelId ?? { $exists: true },
		...(!createdByCurrentUser && { userCount: { $gt: 1 } }),
		...(createdByName ? { createdByName } : { featured: true }),
	};
	const assistants = await collections.assistants
		.find(filter)
		.skip(NUM_PER_PAGE * pageIndex)
		.sort({ userCount: -1 })
		.limit(NUM_PER_PAGE)
		.toArray();

	const numTotalItems = await collections.assistants.countDocuments(filter);

	return {
		assistants: JSON.parse(JSON.stringify(assistants)) as Array<Assistant>,
		selectedModel: modelId ?? "",
		numTotalItems,
		numItemsPerPage: NUM_PER_PAGE,
	};
};
