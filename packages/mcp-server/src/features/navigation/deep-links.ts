/**
 * Database of known deep links for popular Android apps.
 * Used by phone_deep_link and phone_batch deep_link action.
 */

interface AppDeepLinks {
  readonly packageName: string;
  readonly links: Record<string, string>;
}

export const DEEP_LINKS_DB: Record<string, AppDeepLinks> = {
  // ── Social Media ──────────────────────────────────
  // X/Twitter deep links are mostly broken since the rebranding.
  // Best approach: use run_app + ui_tree navigation instead.
  twitter: {
    packageName: "com.twitter.android",
    links: {
      home: "twitter://timeline",
      compose: "twitter://post?message=",
    },
  },
  instagram: {
    packageName: "com.instagram.android",
    links: {
      home: "instagram://feed",
      direct: "instagram://direct",
      camera: "instagram://camera",
      profile: "instagram://user?username=",
      explore: "instagram://explore",
      reels: "instagram://reels",
      story_camera: "instagram://story_camera",
    },
  },
  whatsapp: {
    packageName: "com.whatsapp",
    links: {
      home: "whatsapp://",
      send: "whatsapp://send?phone=",
      settings: "whatsapp://settings",
      status: "whatsapp://status",
    },
  },
  tiktok: {
    packageName: "com.zhiliaoapp.musically",
    links: {
      home: "snssdk1233://feed",
      profile: "snssdk1233://user/profile/",
      inbox: "snssdk1233://inbox",
      camera: "snssdk1233://camera",
    },
  },
  snapchat: {
    packageName: "com.snapchat.android",
    links: {
      home: "snapchat://",
      chat: "snapchat://chat",
      camera: "snapchat://camera",
      map: "snapchat://map",
      stories: "snapchat://stories",
      profile: "snapchat://add/",
    },
  },
  telegram: {
    packageName: "org.telegram.messenger",
    links: {
      home: "tg://",
      chat: "tg://resolve?domain=",
      settings: "tg://settings",
      contacts: "tg://contacts",
    },
  },
  discord: {
    packageName: "com.discord",
    links: {
      home: "discord://",
      channel: "discord://channels/",
    },
  },
  facebook: {
    packageName: "com.facebook.katana",
    links: {
      home: "fb://feed",
      messenger: "fb://messaging",
      notifications: "fb://notifications",
      profile: "fb://profile/",
      groups: "fb://groups",
      marketplace: "fb://marketplace",
    },
  },
  messenger: {
    packageName: "com.facebook.orca",
    links: {
      home: "fb-messenger://",
      new_message: "fb-messenger://new",
    },
  },
  linkedin: {
    packageName: "com.linkedin.android",
    links: {
      home: "linkedin://feed",
      messaging: "linkedin://messaging",
      mynetwork: "linkedin://mynetwork",
      profile: "linkedin://profile/",
      search: "linkedin://search",
      jobs: "linkedin://jobs",
    },
  },
  threads: {
    packageName: "com.instagram.barcelona",
    links: {
      home: "barcelona://",
    },
  },
  reddit: {
    packageName: "com.reddit.frontpage",
    links: {
      home: "reddit://",
      subreddit: "reddit://r/",
      inbox: "reddit://inbox",
      search: "reddit://search",
    },
  },

  // ── Media & Entertainment ─────────────────────────
  youtube: {
    packageName: "com.google.android.youtube",
    links: {
      home: "youtube://",
      search: "youtube://results?search_query=",
      subscriptions: "youtube://subscriptions",
      library: "youtube://library",
      shorts: "youtube://shorts",
      video: "youtube://watch?v=",
    },
  },
  spotify: {
    packageName: "com.spotify.music",
    links: {
      home: "spotify://",
      search: "spotify://search",
      library: "spotify://library",
      playlist: "spotify://playlist/",
      album: "spotify://album/",
      artist: "spotify://artist/",
      track: "spotify://track/",
    },
  },
  netflix: {
    packageName: "com.netflix.mediaclient",
    links: {
      home: "nflx://",
      search: "nflx://search",
      title: "nflx://title/",
    },
  },
  twitch: {
    packageName: "tv.twitch.android.app",
    links: {
      home: "twitch://",
      stream: "twitch://stream/",
      search: "twitch://search",
    },
  },

  // ── Productivity & Utilities ──────────────────────
  gmail: {
    packageName: "com.google.android.gm",
    links: {
      home: "googlemail://",
      compose: "googlemail://co?to=",
      inbox: "googlemail://inbox",
    },
  },
  maps: {
    packageName: "com.google.android.apps.maps",
    links: {
      home: "google.navigation://",
      search: "geo:0,0?q=",
      directions: "google.navigation:q=",
      coordinates: "geo:",
    },
  },
  chrome: {
    packageName: "com.android.chrome",
    links: {
      home: "googlechrome://",
      url: "googlechrome://navigate?url=",
      new_tab: "googlechrome://newtab",
    },
  },
  settings: {
    packageName: "com.android.settings",
    links: {
      home: "android.settings://settings",
      wifi: "android.settings://WIFI_SETTINGS",
      bluetooth: "android.settings://BLUETOOTH_SETTINGS",
      display: "android.settings://DISPLAY_SETTINGS",
      sound: "android.settings://SOUND_SETTINGS",
      battery: "android.settings://BATTERY_SAVER_SETTINGS",
      apps: "android.settings://APPLICATION_SETTINGS",
      developer: "android.settings://APPLICATION_DEVELOPMENT_SETTINGS",
      location: "android.settings://LOCATION_SOURCE_SETTINGS",
      security: "android.settings://SECURITY_SETTINGS",
      notifications: "android.settings://NOTIFICATION_SETTINGS",
    },
  },
  calendar: {
    packageName: "com.google.android.calendar",
    links: {
      home: "content://com.android.calendar/time/",
      new_event: "content://com.android.calendar/events",
    },
  },
  phone: {
    packageName: "com.android.dialer",
    links: {
      dial: "tel:",
      contacts: "content://contacts/people/",
    },
  },
  sms: {
    packageName: "com.android.mms",
    links: {
      compose: "sms:",
      send: "smsto:",
    },
  },

  // ── Shopping ──────────────────────────────────────
  amazon: {
    packageName: "com.amazon.mShop.android.shopping",
    links: {
      home: "amzn://",
      search: "amzn://apps/android?s=",
    },
  },

  // ── Transport ─────────────────────────────────────
  uber: {
    packageName: "com.ubercab",
    links: {
      home: "uber://",
      ride: "uber://riderequest",
    },
  },

  // ── Dev Tools ─────────────────────────────────────
  github: {
    packageName: "com.github.android",
    links: {
      home: "github://",
      repo: "github://repo/",
    },
  },

  // ── AI ────────────────────────────────────────────
  chatgpt: {
    packageName: "com.openai.chatgpt",
    links: {
      home: "chatgpt://",
    },
  },
  claude: {
    packageName: "com.anthropic.claude",
    links: {
      home: "claude://",
    },
  },
} as const;

/**
 * Get all available deep links as a formatted string for the MCP tool description.
 */

/**
 * Resolve a shorthand like "twitter:messages" to the full deep link URI.
 * Also accepts raw URIs (anything containing "://").
 */
export function resolveDeepLink(input: string): string | null {
  // Raw URI pass-through: anything with "://" or known schemes like "tel:", "sms:", "geo:"
  if (input.includes("://")) return input;
  const rawSchemes = ["tel:", "sms:", "smsto:", "mailto:", "geo:"];
  if (rawSchemes.some((s) => input.toLowerCase().startsWith(s))) return input;

  // Shorthand: "app:action" or "app:action:param"
  const parts = input.split(":");
  if (parts.length < 2) return null;

  const appName = parts[0]!.toLowerCase();
  const action = parts[1]!.toLowerCase();
  const param = parts.slice(2).join(":");

  const app = DEEP_LINKS_DB[appName];
  if (!app) return null;

  const uri = app.links[action];
  if (!uri) return null;

  return param ? `${uri}${param}` : uri;
}
