import { handleHttpRequest } from "../server.mjs";

export default async function handler(req, res) {
  return handleHttpRequest(req, res);
}

