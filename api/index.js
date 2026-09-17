import { handleHttpRequest } from "../p1-server.mjs";

export default async function handler(req, res) {
  return handleHttpRequest(req, res);
}

