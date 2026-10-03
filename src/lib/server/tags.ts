import type { Component, NewComponentRequest, NewComponentResponse, TagAssignment } from "@/lib/types";
import { nextFreeTag, TAG_TO_COMPONENT } from "@/lib/markers";
import { TAG_FAMILY_SIZE } from "@/lib/tag-svg";
import { deleteComponent, getAsset, getComponent, insertComponent, insertTag, listComponents, listTags, TagsTableMissing } from "./data";

/** Tags from the table, or the static map when the table is not there yet. */
export async function tagsOrFallback(): Promise<{ tags: TagAssignment[]; live: boolean }> {
  try {
    return { tags: await listTags(), live: true };
  } catch (cause) {
    if (!(cause instanceof TagsTableMissing)) throw cause;
    console.error("[tags]", cause.message);
    return { tags: Object.entries(TAG_TO_COMPONENT).map(([tag_id, component_id]) => ({ tag_id: Number(tag_id), component_id })), live: false };
  }
}

export class TagError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/** Binds the smallest free 36h11 id to a part that has none. */
export async function assignTag(componentId: string): Promise<TagAssignment> {
  const component = await getComponent(componentId);
  if (!component) throw new TagError(`Unknown component: ${componentId}`, 404);
  const tags = await listTags();
  const existing = tags.find((t) => t.component_id === componentId);
  if (existing) throw new TagError(`${component.name} already has tag ${existing.tag_id}.`, 409);
  const tag_id = nextFreeTag(tags.map((t) => t.tag_id), TAG_FAMILY_SIZE);
  if (tag_id === null) throw new TagError("Every 36h11 id is taken.", 409);
  return insertTag({ tag_id, component_id: componentId });
}

/** Creates a part under an asset and gives it a tag in one go. */
export async function addComponent(body: NewComponentRequest): Promise<NewComponentResponse> {
  const asset = await getAsset(body.asset_id);
  if (!asset) throw new TagError(`Unknown asset: ${body.asset_id}`, 404);
  await listTags(); // fail before creating anything if the tags table is missing
  const taken = new Set((await listComponents()).map((c) => c.id));
  const id = uniqueId(slug(body.name), taken);
  const component: Component = { id, asset_id: asset.id, name: body.name, location: body.location };
  const saved = await insertComponent(component);
  try {
    const tag = await assignTag(saved.id);
    return { component: saved, tag };
  } catch (cause) {
    await deleteComponent(saved.id).catch(() => { /* best effort */ });
    throw cause;
  }
}

function slug(text: string): string {
  const s = text.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  return s || "part";
}

function uniqueId(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
}
