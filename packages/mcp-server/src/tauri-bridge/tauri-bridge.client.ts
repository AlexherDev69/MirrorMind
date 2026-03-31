import {
  DEFAULT_API_PORT,
  API_ENDPOINTS,
  type ApiResponse,
  type ScreenshotResponse,
  type TapRequest,
  type SwipeRequest,
  type TypeTextRequest,
  type KeyPressRequest,
  type DisplaySizeResponse,
  type CurrentActivityResponse,
  type RunAppRequest,
  type StreamStatus,
} from "@phone-stream/shared";
import { logger } from "../core/logger.js";

interface DeviceInfo {
  readonly serial: string;
  readonly model: string;
  readonly brand: string;
  readonly androidVersion: string;
  readonly screenSize: string;
}

interface HealthData {
  readonly version: string;
  readonly uptimeMs: number;
}

/**
 * HTTP client that bridges the MCP server to the Tauri internal API.
 */
const DISPLAY_SIZE_CACHE_TTL_MS = 30_000;

export class TauriBridgeClient {
  private readonly baseUrl: string;
  private readonly authToken: string;
  private readonly port: number;
  private displaySizeCache: { data: DisplaySizeResponse; expiry: number } | null = null;

  constructor(authToken: string, port: number = DEFAULT_API_PORT) {
    this.baseUrl = `http://127.0.0.1:${port}`;
    this.authToken = authToken;
    this.port = port;
  }

  async health(timeoutMs: number = 5000): Promise<HealthData> {
    return this.request<HealthData>("GET", API_ENDPOINTS.HEALTH, undefined, false, timeoutMs);
  }

  async screenshot(deviceId?: string): Promise<ScreenshotResponse> {
    return this.request<ScreenshotResponse>("POST", API_ENDPOINTS.SCREENSHOT, { deviceId });
  }

  async displaySize(deviceId?: string): Promise<DisplaySizeResponse> {
    const now = Date.now();
    if (this.displaySizeCache && now < this.displaySizeCache.expiry) {
      return this.displaySizeCache.data;
    }
    const data = await this.request<DisplaySizeResponse>("POST", API_ENDPOINTS.DISPLAY_SIZE, { deviceId });
    this.displaySizeCache = { data, expiry: now + DISPLAY_SIZE_CACHE_TTL_MS };
    return data;
  }

  async tap(params: TapRequest): Promise<string> {
    return this.request<string>("POST", API_ENDPOINTS.TAP, params);
  }

  async swipe(params: SwipeRequest): Promise<string> {
    return this.request<string>("POST", API_ENDPOINTS.SWIPE, params);
  }

  async typeText(params: TypeTextRequest): Promise<string> {
    return this.request<string>("POST", API_ENDPOINTS.TYPE, params);
  }

  async pressKey(params: KeyPressRequest): Promise<string> {
    return this.request<string>("POST", API_ENDPOINTS.KEY, params);
  }

  async listDevices(): Promise<DeviceInfo[]> {
    return this.request<DeviceInfo[]>("GET", API_ENDPOINTS.DEVICES);
  }

  async getDeviceInfo(serial: string): Promise<DeviceInfo> {
    return this.request<DeviceInfo>("GET", `${API_ENDPOINTS.DEVICE_INFO}/${serial}`);
  }

  async currentActivity(deviceId?: string): Promise<CurrentActivityResponse> {
    return this.request<CurrentActivityResponse>("POST", API_ENDPOINTS.CURRENT_ACTIVITY, { deviceId });
  }

  async runApp(params: RunAppRequest): Promise<string> {
    return this.request<string>("POST", API_ENDPOINTS.RUN_APP, params);
  }

  async uiTree(deviceId?: string): Promise<string> {
    return this.request<string>("POST", API_ENDPOINTS.UI_TREE, { deviceId });
  }

  async deepLink(uri: string, deviceId?: string): Promise<string> {
    return this.request<string>("POST", API_ENDPOINTS.DEEP_LINK, { uri, deviceId });
  }

  async listMacros(): Promise<Array<{ name: string; description: string; actionCount: number; duration: number }>> {
    return this.request("GET", API_ENDPOINTS.MACROS);
  }

  async loadMacro(name: string): Promise<string> {
    return this.request("GET", `${API_ENDPOINTS.MACRO}/${encodeURIComponent(name)}`);
  }

  async getStreamStatus(): Promise<StreamStatus> {
    return this.request<StreamStatus>("GET", API_ENDPOINTS.STREAM_STATUS);
  }

  private async request<T>(
    method: string,
    endpoint: string,
    body?: unknown,
    requireAuth: boolean = true,
    timeoutMs: number = 5000,
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Host: `127.0.0.1:${this.port}`,
    };

    if (requireAuth) {
      headers["Authorization"] = `Bearer ${this.authToken}`;
    }

    const options: RequestInit = {
      method,
      headers,
      signal: AbortSignal.timeout(timeoutMs),
    };
    if (body !== undefined && method !== "GET") {
      options.body = JSON.stringify(body);
    }

    let response: Response;
    try {
      response = await fetch(url, options);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`Failed to connect to Tauri app at ${url}: ${msg}`);
      throw new Error(
        `Cannot reach PhoneStream app. Make sure it is running. (${msg})`,
      );
    }

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`API error ${response.status}: ${text}`);
    }

    const json = (await response.json()) as ApiResponse<T>;

    if (!json.success) {
      throw new Error(json.error ?? "Unknown API error");
    }

    return json.data as T;
  }
}
