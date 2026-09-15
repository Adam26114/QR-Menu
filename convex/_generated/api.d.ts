/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as authBootstrap from "../authBootstrap.js";
import type * as authBootstrapPolicy from "../authBootstrapPolicy.js";
import type * as betterAuthOptions from "../betterAuthOptions.js";
import type * as betterAuthServer from "../betterAuthServer.js";
import type * as http from "../http.js";
import type * as lib_customFunctions from "../lib/customFunctions.js";
import type * as lib_errors from "../lib/errors.js";
import type * as memberships from "../memberships.js";
import type * as menu from "../menu.js";
import type * as model_identity from "../model/identity.js";
import type * as model_menu from "../model/menu.js";
import type * as model_projects from "../model/projects.js";
import type * as model_restaurants from "../model/restaurants.js";
import type * as model_subscriptions from "../model/subscriptions.js";
import type * as projects from "../projects.js";
import type * as restaurants from "../restaurants.js";
import type * as subscriptions from "../subscriptions.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  authBootstrap: typeof authBootstrap;
  authBootstrapPolicy: typeof authBootstrapPolicy;
  betterAuthOptions: typeof betterAuthOptions;
  betterAuthServer: typeof betterAuthServer;
  http: typeof http;
  "lib/customFunctions": typeof lib_customFunctions;
  "lib/errors": typeof lib_errors;
  memberships: typeof memberships;
  menu: typeof menu;
  "model/identity": typeof model_identity;
  "model/menu": typeof model_menu;
  "model/projects": typeof model_projects;
  "model/restaurants": typeof model_restaurants;
  "model/subscriptions": typeof model_subscriptions;
  projects: typeof projects;
  restaurants: typeof restaurants;
  subscriptions: typeof subscriptions;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  betterAuth: import("../betterAuth/_generated/component.js").ComponentApi<"betterAuth">;
};
