
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end("Method not allowed");

  const { videoId, downloadUrl, status, metadata } = req.body;

  if (status !== "completed" || !downloadUrl) {
    return res.status(400).json({ error: "Video not ready" });
  }

  try {
    const questionId = metadata?.questionId || process.env.QUESTION_UUID;

    const response = await fetch(downloadUrl);
    const buffer = await response.arrayBuffer();
    const file = new Uint8Array(buffer);

    const uploadPath = `questions/${questionId}.mp4`;

    const { error: uploadError } = await supabase.storage
      .from("nova-videos")
      .upload(uploadPath, file, {
        contentType: "video/mp4",
        upsert: true
      });

    if (uploadError) {
      throw new Error("Upload failed: " + uploadError.message);
    }

    const publicUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/nova-videos/${uploadPath}`;

    const { error: updateError } = await supabase
      .from("nova_questions")
      .update({ video_question_fr: publicUrl })
      .eq("id", questionId);

    if (updateError) {
      throw new Error("Database update failed: " + updateError.message);
    }

    return res.status(200).json({ success: true, publicUrl });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
