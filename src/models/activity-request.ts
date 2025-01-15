import { PagerRequest } from "./pager-request.js";

export type ActivityRequest = Omit<PagerRequest, 'structureType'>;