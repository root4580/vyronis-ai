import type { MetadataRoute } from "next"
import { APP_DESCRIPTION, APP_HOME_PATH, APP_NAME } from "@/lib/branding"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: APP_NAME,
    description: APP_DESCRIPTION,
    start_url: APP_HOME_PATH,
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#06b6d4",
    icons: [
      {
        src: "/icon-light-32x32.png",
        sizes: "32x32",
        type: "image/png",
      },
      {
        src: "/apple-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  }
}
