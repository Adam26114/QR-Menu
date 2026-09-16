/// <reference types="vite/client" />
import { convexTest } from "convex-test"
import { expect, test } from "vitest"
import { api, internal } from "./_generated/api"
import schema from "./schema"
import { assertOrderableItem } from "./model/menu"
import type { Id } from "./_generated/dataModel"

const modules = import.meta.glob("./**/*.ts")

test("menu APIs require authentication", async () => {
    const t = convexTest(schema, modules)
    const owner = t.withIdentity({
        subject: "owner",
        tokenIdentifier: "issuer|owner",
    })
    const restaurantId = await owner.mutation(api.restaurants.create, {
        name: "Auth Cafe",
        slug: "auth-cafe",
        idempotencyKey: "auth-cafe",
    })
    await expect(
        t.query(api.menu.listCategories, { restaurantId })
    ).rejects.toThrow("AUTH_REQUIRED")
})

test("an owner can create and list menu categories and items", async () => {
    const t = convexTest(schema, modules)
    const owner = t.withIdentity({
        subject: "owner",
        tokenIdentifier: "issuer|owner",
    })
    const restaurantId = await owner.mutation(api.restaurants.create, {
        name: "Menu Cafe",
        slug: "menu-cafe",
        idempotencyKey: "menu-cafe",
    })
    const categoryId = await owner.mutation(api.menu.createCategory, {
        restaurantId,
        name: " Mains ",
    })
    const itemId = await owner.mutation(api.menu.createItem, {
        restaurantId,
        categoryId,
        name: "Noodles",
        priceMinor: 1200,
    })
    expect(
        (await owner.query(api.menu.listCategories, { restaurantId }))[0].name
    ).toBe("Mains")
    expect(
        (await owner.query(api.menu.listItems, { restaurantId }))[0]._id
    ).toBe(itemId)
})

test("option group updates persist selection mode and reorder requires an exact active permutation", async () => {
    const t = convexTest(schema, modules)
    const owner = t.withIdentity({
        subject: "owner",
        tokenIdentifier: "issuer|owner",
    })
    const restaurantId = await owner.mutation(api.restaurants.create, {
        name: "Options Cafe",
        slug: "options-cafe",
        idempotencyKey: "options-cafe",
    })
    const first = await owner.mutation(api.menu.createCategory, {
        restaurantId,
        name: "Mains",
    })
    const second = await owner.mutation(api.menu.createCategory, {
        restaurantId,
        name: "Sides",
    })
    const item = await owner.mutation(api.menu.createItem, {
        restaurantId,
        categoryId: first,
        name: "Rice",
        priceMinor: 500,
    })
    const group = await owner.mutation(api.menu.createOptionGroup, {
        itemId: item,
        name: "Toppings",
        selectionMode: "single",
        required: false,
        minSelections: 0,
        maxSelections: 1,
    })
    const updated = await owner.mutation(api.menu.updateOptionGroup, {
        optionGroupId: group,
        selectionMode: "multiple",
        maxSelections: 3,
    })
    expect(updated.selectionMode).toBe("multiple")
    await expect(
        owner.mutation(api.menu.reorderCategories, {
            restaurantId,
            orderedCategoryIds: [first],
        })
    ).rejects.toThrow("VALIDATION_FAILED")
    await owner.mutation(api.menu.reorderCategories, {
        restaurantId,
        orderedCategoryIds: [second, first],
    })
    expect(
        (await owner.query(api.menu.listCategories, { restaurantId }))[0]._id
    ).toBe(second)
})

test("archived categories and items are excluded and cannot receive new items", async () => {
    const t = convexTest(schema, modules)
    const owner = t.withIdentity({
        subject: "archive-owner",
        tokenIdentifier: "issuer|archive-owner",
    })
    const restaurantId = await owner.mutation(api.restaurants.create, {
        name: "Archive Cafe",
        slug: "archive-cafe",
        idempotencyKey: "archive-cafe",
    })
    const active = await owner.mutation(api.menu.createCategory, {
        restaurantId,
        name: "Active",
    })
    const archived = await owner.mutation(api.menu.createCategory, {
        restaurantId,
        name: "Archived",
    })
    const item = await owner.mutation(api.menu.createItem, {
        restaurantId,
        categoryId: active,
        name: "Soup",
        priceMinor: 400,
    })
    await owner.mutation(api.menu.archiveCategory, { categoryId: archived })
    await expect(
        owner.mutation(api.menu.createItem, {
            restaurantId,
            categoryId: archived,
            name: "Nope",
            priceMinor: 100,
        })
    ).rejects.toThrow("CONFLICT")
    await expect(
        owner.mutation(api.menu.updateItem, {
            itemId: item,
            categoryId: archived,
        })
    ).rejects.toThrow("CONFLICT")
    expect(
        await owner.query(api.menu.listItems, {
            restaurantId,
            categoryId: archived,
        })
    ).toEqual([])
    expect(
        await owner.query(api.menu.listItems, { restaurantId })
    ).toHaveLength(1)
    expect(
        await owner.query(api.menu.listItems, {
            restaurantId,
            categoryId: archived,
            includeArchived: true,
        })
    ).toEqual([])
    await owner.mutation(api.menu.archiveItem, { itemId: item })
    expect(await owner.query(api.menu.listItems, { restaurantId })).toEqual([])
    expect(
        await owner.query(api.menu.listItems, {
            restaurantId,
            includeArchived: true,
        })
    ).toMatchObject([{ _id: item }])
    await owner.mutation(api.menu.restoreItem, { itemId: item })
    await owner.mutation(api.menu.restoreCategory, { categoryId: archived })
    const restoredItem = await owner.mutation(api.menu.createItem, {
        restaurantId,
        categoryId: archived,
        name: "Bread",
        priceMinor: 200,
    })
    expect(
        await owner.query(api.menu.listItems, {
            restaurantId,
            categoryId: archived,
        })
    ).toMatchObject([{ _id: restoredItem }])
})

test("menu access is tenant-scoped and staff is read-only", async () => {
    const t = convexTest(schema, modules)
    const owner = t.withIdentity({
        subject: "tenant-owner",
        tokenIdentifier: "issuer|tenant-owner",
    })
    const other = t.withIdentity({
        subject: "other-owner",
        tokenIdentifier: "issuer|other-owner",
    })
    const restaurantId = await owner.mutation(api.restaurants.create, {
        name: "Tenant Cafe",
        slug: "tenant-cafe",
        idempotencyKey: "tenant-cafe",
    })
    const categoryId = await owner.mutation(api.menu.createCategory, {
        restaurantId,
        name: "Mains",
    })
    const itemId = await owner.mutation(api.menu.createItem, {
        restaurantId,
        categoryId,
        name: "Rice",
        priceMinor: 500,
    })
    await t.run(async (ctx) => {
        await ctx.db.insert("restaurantMemberships", {
            restaurantId,
            tokenIdentifier: "issuer|staff",
            role: "staff",
            status: "active",
            canMarkPaid: false,
            createdAt: 1,
            updatedAt: 1,
        })
    })
    const staff = t.withIdentity({
        subject: "staff",
        tokenIdentifier: "issuer|staff",
    })
    await expect(
        other.query(api.menu.listCategories, { restaurantId })
    ).rejects.toThrow("FORBIDDEN")
    await expect(
        other.mutation(api.menu.updateItem, { itemId, name: "Changed" })
    ).rejects.toThrow("FORBIDDEN")
    expect(
        await staff.query(api.menu.listCategories, { restaurantId })
    ).toHaveLength(1)
    expect(
        await staff.query(api.menu.listItems, { restaurantId })
    ).toHaveLength(1)
    await expect(
        staff.mutation(api.menu.updateItem, { itemId, name: "Changed" })
    ).rejects.toThrow("FORBIDDEN")
    await expect(
        staff.mutation(api.menu.createCategory, { restaurantId, name: "Nope" })
    ).rejects.toThrow("FORBIDDEN")
})

test("menu validation and orderability reject invalid data and unavailable or archived items", async () => {
    const t = convexTest(schema, modules)
    const owner = t.withIdentity({
        subject: "validation-owner",
        tokenIdentifier: "issuer|validation-owner",
    })
    const restaurantId = await owner.mutation(api.restaurants.create, {
        name: "Validation Cafe",
        slug: "validation-cafe",
        idempotencyKey: "validation-cafe",
    })
    const categoryId = await owner.mutation(api.menu.createCategory, {
        restaurantId,
        name: "Mains",
    })
    const itemId = await owner.mutation(api.menu.createItem, {
        restaurantId,
        categoryId,
        name: "Rice",
        priceMinor: 500,
    })
    await expect(
        owner.mutation(api.menu.createItem, {
            restaurantId,
            categoryId,
            name: "Bad",
            priceMinor: -1,
        })
    ).rejects.toThrow("VALIDATION_FAILED")
    const groupId = await owner.mutation(api.menu.createOptionGroup, {
        itemId,
        name: "Size",
        selectionMode: "multiple",
        required: false,
        minSelections: 0,
        maxSelections: 2,
    })
    await expect(
        owner.mutation(api.menu.createOptionChoice, {
            optionGroupId: groupId,
            name: "Bad",
            priceDeltaMinor: 1.5,
        })
    ).rejects.toThrow("VALIDATION_FAILED")
    await expect(
        owner.mutation(api.menu.updateOptionGroup, {
            optionGroupId: groupId,
            minSelections: 3,
            maxSelections: 2,
        })
    ).rejects.toThrow("VALIDATION_FAILED")
    await expect(
        t.run(async (ctx) => assertOrderableItem(ctx, itemId))
    ).resolves.toMatchObject({ _id: itemId })
    await owner.mutation(api.menu.setAvailability, { itemId, available: false })
    await expect(
        t.run(async (ctx) => assertOrderableItem(ctx, itemId))
    ).rejects.toThrow("CONFLICT")
    await owner.mutation(api.menu.setAvailability, { itemId, available: true })
    await owner.mutation(api.menu.archiveItem, { itemId })
    await expect(
        t.run(async (ctx) => assertOrderableItem(ctx, itemId))
    ).rejects.toThrow("CONFLICT")
})

test("option groups and choices remain tenant-scoped and fail closed on malformed ownership", async () => {
    const t = convexTest(schema, modules)
    const owner = t.withIdentity({
        subject: "options-owner",
        tokenIdentifier: "issuer|options-owner",
    })
    const other = t.withIdentity({
        subject: "options-other",
        tokenIdentifier: "issuer|options-other",
    })
    const restaurantId = await owner.mutation(api.restaurants.create, {
        name: "Options Tenant",
        slug: "options-tenant",
        idempotencyKey: "options-tenant",
    })
    const otherRestaurantId = await other.mutation(api.restaurants.create, {
        name: "Other Tenant",
        slug: "other-tenant",
        idempotencyKey: "other-tenant",
    })
    const categoryId = await owner.mutation(api.menu.createCategory, {
        restaurantId,
        name: "Mains",
    })
    const itemId = await owner.mutation(api.menu.createItem, {
        restaurantId,
        categoryId,
        name: "Rice",
        priceMinor: 500,
    })
    const groupId = await owner.mutation(api.menu.createOptionGroup, {
        itemId,
        name: "Size",
        selectionMode: "single",
        required: false,
        minSelections: 0,
        maxSelections: 1,
    })
    const choiceId = await owner.mutation(api.menu.createOptionChoice, {
        optionGroupId: groupId,
        name: "Small",
        priceDeltaMinor: 0,
    })

    await expect(
        other.query(api.menu.listOptionGroups, { itemId: itemId })
    ).rejects.toThrow("FORBIDDEN")
    await expect(
        other.query(api.menu.listOptionChoices, { optionGroupId: groupId })
    ).rejects.toThrow("FORBIDDEN")
    await expect(
        other.mutation(api.menu.updateOptionGroup, {
            optionGroupId: groupId,
            name: "Nope",
        })
    ).rejects.toThrow("FORBIDDEN")
    await expect(
        other.mutation(api.menu.updateOptionChoice, {
            optionChoiceId: choiceId,
            name: "Nope",
        })
    ).rejects.toThrow("FORBIDDEN")
    await expect(
        other.mutation(api.menu.archiveOptionGroup, { optionGroupId: groupId })
    ).rejects.toThrow("FORBIDDEN")
    await expect(
        other.mutation(api.menu.archiveOptionChoice, {
            optionChoiceId: choiceId,
        })
    ).rejects.toThrow("FORBIDDEN")

    await t.run(async (ctx) => {
        await ctx.db.patch(groupId, { restaurantId: otherRestaurantId })
    })
    await expect(
        owner.query(api.menu.listOptionGroups, { itemId: itemId })
    ).rejects.toThrow("NOT_FOUND")
    await expect(
        owner.query(api.menu.listOptionChoices, { optionGroupId: groupId })
    ).rejects.toThrow("NOT_FOUND")
    await expect(
        t.run(async (ctx) => assertOrderableItem(ctx, itemId))
    ).rejects.toThrow("NOT_FOUND")

    await t.run(async (ctx) => {
        await ctx.db.patch(groupId, { restaurantId })
    })
    await t.run(async (ctx) => {
        await ctx.db.patch(choiceId, { restaurantId: otherRestaurantId })
    })
    await expect(
        owner.query(api.menu.listOptionChoices, { optionGroupId: groupId })
    ).rejects.toThrow("NOT_FOUND")
    await expect(
        t.run(async (ctx) => assertOrderableItem(ctx, itemId))
    ).rejects.toThrow("NOT_FOUND")
})

test("reorder accepts 200 active records and rejects 201", async () => {
    const t = convexTest(schema, modules)
    const owner = t.withIdentity({
        subject: "reorder-owner",
        tokenIdentifier: "issuer|reorder-owner",
    })
    const restaurantId = await owner.mutation(api.restaurants.create, {
        name: "Reorder Cafe",
        slug: "reorder-cafe",
        idempotencyKey: "reorder-cafe",
    })
    const { categoryIds, itemIds, itemCategoryId } = await t.run(
        async (ctx) => {
            const now = Date.now()
            const categoryIds: Id<"menuCategories">[] = []
            for (let i = 0; i < 201; i++) {
                categoryIds.push(
                    await ctx.db.insert("menuCategories", {
                        restaurantId,
                        name: `Category ${i}`,
                        sortOrder: i,
                        archived: i === 200,
                        createdAt: now,
                        updatedAt: now,
                    })
                )
            }
            const itemCategoryId = categoryIds[0]!
            const itemIds: Id<"menuItems">[] = []
            for (let i = 0; i < 201; i++) {
                itemIds.push(
                    await ctx.db.insert("menuItems", {
                        restaurantId,
                        categoryId: itemCategoryId,
                        name: `Item ${i}`,
                        priceMinor: i,
                        available: true,
                        archived: i === 200,
                        sortOrder: i,
                        createdAt: now,
                        updatedAt: now,
                    })
                )
            }
            return { categoryIds, itemIds, itemCategoryId }
        }
    )

    await owner.mutation(api.menu.reorderCategories, {
        restaurantId,
        orderedCategoryIds: categoryIds.slice(0, 200),
    })
    await owner.mutation(api.menu.restoreCategory, {
        categoryId: categoryIds[200]!,
    })
    await expect(
        owner.mutation(api.menu.reorderCategories, {
            restaurantId,
            orderedCategoryIds: categoryIds,
        })
    ).rejects.toThrow("CONFLICT")

    await owner.mutation(api.menu.reorderItems, {
        restaurantId,
        categoryId: itemCategoryId,
        orderedItemIds: itemIds.slice(0, 200),
    })
    await owner.mutation(api.menu.restoreItem, { itemId: itemIds[200]! })
    await expect(
        owner.mutation(api.menu.reorderItems, {
            restaurantId,
            categoryId: itemCategoryId,
            orderedItemIds: itemIds,
        })
    ).rejects.toThrow("CONFLICT")
})

test("image upload capabilities are owner-only and item-scoped", async () => {
    const t = convexTest(schema, modules)
    const owner = t.withIdentity({
        subject: "upload-owner",
        tokenIdentifier: "issuer|upload-owner",
    })
    const staff = t.withIdentity({
        subject: "upload-staff",
        tokenIdentifier: "issuer|upload-staff",
    })
    const other = t.withIdentity({
        subject: "upload-other",
        tokenIdentifier: "issuer|upload-other",
    })
    const restaurantId = await owner.mutation(api.restaurants.create, {
        name: "Upload Cafe",
        slug: "upload-cafe",
        idempotencyKey: "upload-cafe",
    })
    await t.run(async (ctx) => {
        await ctx.db.insert("restaurantMemberships", {
            restaurantId,
            tokenIdentifier: "issuer|upload-staff",
            role: "staff",
            status: "active",
            canMarkPaid: false,
            createdAt: 1,
            updatedAt: 1,
        })
    })
    const categoryId = await owner.mutation(api.menu.createCategory, {
        restaurantId,
        name: "Mains",
    })
    const itemId = await owner.mutation(api.menu.createItem, {
        restaurantId,
        categoryId,
        name: "Rice",
        priceMinor: 500,
    })
    const otherItemId = await owner.mutation(api.menu.createItem, {
        restaurantId,
        categoryId,
        name: "Soup",
        priceMinor: 400,
    })
    await expect(
        staff.mutation(api.menu.generateImageUploadUrl, { itemId })
    ).rejects.toThrow("FORBIDDEN")
    await expect(
        other.mutation(api.menu.generateImageUploadUrl, { itemId })
    ).rejects.toThrow("FORBIDDEN")
    const result = await owner.mutation(api.menu.generateImageUploadUrl, {
        itemId,
    })
    expect(result.url).toEqual(expect.any(String))
    expect(result.capability).toEqual(expect.any(String))
    const storageId = itemId.replace(/menuItems$/, "_storage") as Id<"_storage">
    await expect(
        owner.mutation(api.menu.bindImageUpload, {
            itemId: otherItemId,
            storageId,
            capability: result.capability,
        })
    ).rejects.toThrow("FORBIDDEN")
    await expect(
        other.mutation(api.menu.attachImage, {
            itemId,
            storageId,
            capability: result.capability,
        })
    ).rejects.toThrow("FORBIDDEN")
    await expect(
        staff.mutation(api.menu.attachImage, {
            itemId,
            storageId,
            capability: result.capability,
        })
    ).rejects.toThrow("FORBIDDEN")
})

test("expired capabilities are rejected and stale image URLs resolve null", async () => {
    const t = convexTest(schema, modules)
    const owner = t.withIdentity({
        subject: "expired-owner",
        tokenIdentifier: "issuer|expired-owner",
    })
    const restaurantId = await owner.mutation(api.restaurants.create, {
        name: "Expired Cafe",
        slug: "expired-cafe",
        idempotencyKey: "expired-cafe",
    })
    const categoryId = await owner.mutation(api.menu.createCategory, {
        restaurantId,
        name: "Mains",
    })
    const itemId = await owner.mutation(api.menu.createItem, {
        restaurantId,
        categoryId,
        name: "Soup",
        priceMinor: 400,
    })
    const storageId = itemId.replace(/menuItems$/, "_storage") as Id<"_storage">
    const capability = await t.run(async (ctx) =>
        ctx.db.insert("pendingStorageUploads", {
            restaurantId,
            uploadedByTokenIdentifier: "issuer|expired-owner",
            itemId,
            storageId,
            expiresAt: 0,
            createdAt: 0,
        })
    )
    await expect(
        owner.mutation(api.menu.attachImage, { itemId, storageId, capability })
    ).rejects.toThrow("FORBIDDEN")
    await t.run(async (ctx) => {
        await ctx.db.insert("storageUploads", {
            storageId,
            restaurantId,
            uploadedByTokenIdentifier: "issuer|expired-owner",
            itemId,
            createdAt: 0,
        })
        await ctx.db.patch(itemId, { imageStorageId: storageId })
    })
    await expect(
        owner.query(api.menu.resolveImageUrl, { itemId })
    ).resolves.toBeNull()
    await t.mutation(internal.menu.cleanupStorage, { limit: 100 })
    await t.run(async (ctx) => {
        expect(await ctx.db.get(capability)).toBeNull()
        expect(
            await ctx.db
                .query("storageUploads")
                .withIndex("by_storage_id", (q) => q.eq("storageId", storageId))
                .unique()
        ).toBeNull()
    })
})

test("listItems resolves only owned item images and remains tenant-scoped", async () => {
    const t = convexTest(schema, modules)
    const owner = t.withIdentity({
        subject: "image-list-owner",
        tokenIdentifier: "issuer|image-list-owner",
    })
    const other = t.withIdentity({
        subject: "image-list-other",
        tokenIdentifier: "issuer|image-list-other",
    })
    const restaurantId = await owner.mutation(api.restaurants.create, {
        name: "Image List Cafe",
        slug: "image-list-cafe",
        idempotencyKey: "image-list-cafe",
    })
    const otherRestaurantId = await other.mutation(api.restaurants.create, {
        name: "Other Image List Cafe",
        slug: "other-image-list-cafe",
        idempotencyKey: "other-image-list-cafe",
    })
    const categoryId = await owner.mutation(api.menu.createCategory, {
        restaurantId,
        name: "Mains",
    })
    const ownedItemId = await owner.mutation(api.menu.createItem, {
        restaurantId,
        categoryId,
        name: "Owned image",
        priceMinor: 100,
    })
    const missingItemId = await owner.mutation(api.menu.createItem, {
        restaurantId,
        categoryId,
        name: "Missing image",
        priceMinor: 200,
    })
    const wrongItemId = await owner.mutation(api.menu.createItem, {
        restaurantId,
        categoryId,
        name: "Wrong owner relation",
        priceMinor: 300,
    })
    const otherCategoryId = await other.mutation(api.menu.createCategory, {
        restaurantId: otherRestaurantId,
        name: "Other mains",
    })
    const otherItemId = await other.mutation(api.menu.createItem, {
        restaurantId: otherRestaurantId,
        categoryId: otherCategoryId,
        name: "Foreign image",
        priceMinor: 400,
    })

    const ids = await t.run(async (ctx) => {
        const ownedStorageId = await ctx.storage.store(
            new Blob(["owned"], { type: "image/png" })
        )
        const wrongStorageId = await ctx.storage.store(
            new Blob(["wrong"], { type: "image/png" })
        )
        const foreignStorageId = await ctx.storage.store(
            new Blob(["foreign"], { type: "image/png" })
        )
        await ctx.db.insert("storageUploads", {
            storageId: ownedStorageId,
            restaurantId,
            uploadedByTokenIdentifier: "issuer|image-list-owner",
            itemId: ownedItemId,
            createdAt: 1,
        })
        await ctx.db.insert("storageUploads", {
            storageId: wrongStorageId,
            restaurantId,
            uploadedByTokenIdentifier: "issuer|image-list-owner",
            itemId: wrongItemId,
            createdAt: 1,
        })
        await ctx.db.insert("storageUploads", {
            storageId: foreignStorageId,
            restaurantId: otherRestaurantId,
            uploadedByTokenIdentifier: "issuer|image-list-other",
            itemId: otherItemId,
            createdAt: 1,
        })
        await ctx.db.patch(ownedItemId, { imageStorageId: ownedStorageId })
        await ctx.db.patch(
            missingItemId,
            {
                imageStorageId: missingItemId.replace(
                    /menuItems$/,
                    "_storage"
                ) as Id<"_storage">,
            }
        )
        await ctx.db.patch(wrongItemId, { imageStorageId: foreignStorageId })
        return { ownedStorageId, wrongStorageId, foreignStorageId }
    })

    const listed = await owner.query(api.menu.listItems, { restaurantId })
    expect(listed).toHaveLength(3)
    expect(listed.find((x) => x._id === ownedItemId)?.imageUrl).toEqual(
        expect.stringContaining("http")
    )
    expect(listed.find((x) => x._id === missingItemId)?.imageUrl).toBeNull()
    expect(listed.find((x) => x._id === wrongItemId)?.imageUrl).toBeNull()
    expect(ids.ownedStorageId).not.toBe(ids.wrongStorageId)
    expect(ids.wrongStorageId).not.toBe(ids.foreignStorageId)
    expect(JSON.stringify(listed)).not.toContain("uploadedByTokenIdentifier")
    await expect(
        other.query(api.menu.listItems, { restaurantId })
    ).rejects.toThrow("FORBIDDEN")
})
