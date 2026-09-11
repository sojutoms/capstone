// utils/tripo3d.js
// Thin client for the Tripo3D OpenAPI (https://docs.tripo3d.ai) — turns 4
// product photos (front/left/back/right) into a textured GLB model.
const axios = require("axios");

const BASE_URL = "https://api.tripo3d.ai/v2/openapi";
const MODEL_VERSION = "v3.1-20260211";

const client = () => {
  const apiKey = process.env.TRIPO_API_KEY;
  if (!apiKey) throw new Error("TRIPO_API_KEY is not set in backend/.env");
  return axios.create({
    baseURL: BASE_URL,
    headers: { Authorization: `Bearer ${apiKey}` },
    timeout: 30000,
  });
};

/**
 * Kicks off a multiview_to_model task. `front` is mandatory; left/back/right
 * are optional but recommended for a full-quality result. Each is a public
 * image URL (Cloudinary URLs work directly — no upload step needed).
 */
const createMultiviewTask = async ({ front, left, back, right }) => {
  if (!front) throw new Error("createMultiviewTask requires a front image");

  const toFile = (url) => (url ? { url } : {});
  const { data } = await client().post("/task", {
    type: "multiview_to_model",
    files: [toFile(front), toFile(left), toFile(back), toFile(right)],
    model_version: MODEL_VERSION,
    texture: true,
    pbr: true,
  });

  const taskId = data?.data?.task_id || data?.task_id;
  if (!taskId) throw new Error(`Tripo3D task creation returned no task_id: ${JSON.stringify(data)}`);
  return taskId;
};

const getTask = async (taskId) => {
  const { data } = await client().get(`/task/${taskId}`);
  return data?.data || data;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Polls a task until it finishes. Resolves with the model URL on success.
 */
const pollTaskUntilDone = async (taskId, { intervalMs = 4000, timeoutMs = 5 * 60 * 1000 } = {}) => {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const task = await getTask(taskId);
    const status = task?.status;

    if (status === "success") {
      // Tripo3D's actual response shape: output.pbr_model is a plain URL string;
      // result.pbr_model.url is the same thing nested — kept as a fallback.
      const modelUrl =
        task?.output?.pbr_model || task?.output?.model || task?.result?.pbr_model?.url || task?.result?.model?.url;
      if (!modelUrl) throw new Error(`Tripo3D task ${taskId} succeeded but returned no model URL`);
      return modelUrl;
    }

    if (status === "failed" || status === "cancelled" || status === "banned") {
      throw new Error(`Tripo3D task ${taskId} ended with status "${status}"`);
    }

    await sleep(intervalMs);
  }

  throw new Error(`Tripo3D task ${taskId} timed out after ${timeoutMs}ms`);
};

module.exports = { createMultiviewTask, getTask, pollTaskUntilDone };
