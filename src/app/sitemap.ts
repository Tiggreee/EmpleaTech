import type { MetadataRoute } from "next";
import { SITIO } from "@/content/sitio";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITIO}/`, changeFrequency: "monthly", priority: 1 },
    { url: `${SITIO}/inteligencia`, changeFrequency: "monthly", priority: 0.6 },
  ];
}

