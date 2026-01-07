import Axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type CustomParamsSerializer
} from "axios";
import type {
  PureHttpError,
  RequestMethods,
  PureHttpResponse,
  PureHttpRequestConfig
} from "./types.d";
import { stringify } from "qs";
import { getToken, formatToken, removeToken } from "@/utils/auth";
import { useUserStoreHook } from "@/store/modules/user";
import router from "@/router";
import oauthConfig from "@/config/oauth";

// 相关配置请参考：www.axios-js.com/zh-cn/docs/#axios-request-config-1
const defaultConfig: AxiosRequestConfig = {
  // 请求超时时间
  timeout: 10000,
  headers: {
    Accept: "application/json, text/plain, */*",
    "Content-Type": "application/json",
    "X-Requested-With": "XMLHttpRequest"
  },
  // 数组格式参数序列化（https://github.com/axios/axios/issues/5142）
  paramsSerializer: {
    serialize: stringify as unknown as CustomParamsSerializer
  }
};

class PureHttp {
  constructor() {
    this.httpInterceptorsRequest();
    this.httpInterceptorsResponse();
  }

  /** `token`过期后，暂存待执行的请求 */
  private static requests: Array<(token: string) => void> = [];

  /** 防止重复刷新`token` */
  private static isRefreshing = false;

  /** 初始化配置对象 */
  private static initConfig: PureHttpRequestConfig = {};

  /** 保存当前`Axios`实例对象 */
  private static axiosInstance: AxiosInstance = Axios.create(defaultConfig);

  /** 请求白名单，放置一些不需要`token`的接口（通过设置请求白名单，防止`token`过期后再请求造成的死循环问题） */
  private static readonly whiteList = [
    "/refresh-token",
    "/login",
    "/connect/token",
    "/connect/authorize"
  ];

  /** 检查URL是否在白名单中 */
  private static isWhiteListUrl(url?: string): boolean {
    if (!url) return false;
    return PureHttp.whiteList.some(
      whiteUrl => url.endsWith(whiteUrl) || url.includes(whiteUrl)
    );
  }

  /** 重连原始请求 */
  private static retryOriginalRequest(config: PureHttpRequestConfig) {
    return new Promise(resolve => {
      PureHttp.requests.push((token: string) => {
        config.headers["Authorization"] = formatToken(token);
        resolve(config);
      });
    });
  }

  /** 处理token刷新逻辑 */
  private static handleTokenRefresh(
    config: PureHttpRequestConfig,
    resolve: (value: PureHttpRequestConfig) => void,
    data: any
  ) {
    PureHttp.isRefreshing = true;
    useUserStoreHook()
      .handRefreshToken({ refreshToken: data.refreshToken })
      .then(res => {
        const token = res.data.accessToken;
        config.headers["Authorization"] = formatToken(token);
        // 执行所有等待的请求
        PureHttp.requests.forEach(cb => cb(token));
        PureHttp.requests = [];
        // 解决当前请求
        resolve(config);
      })
      .catch(error => {
        console.error("刷新token失败:", error);
        // 刷新token失败，清除token并跳转到登录页
        PureHttp.handleLogout();
        // 刷新失败也需要解决当前请求
        resolve(config);
      })
      .finally(() => {
        PureHttp.isRefreshing = false;
      });
  }

  /** 处理登出逻辑 */
  private static handleLogout() {
    removeToken();
    router.push("/login");
  }

  /** 请求拦截 */
  private httpInterceptorsRequest(): void {
    PureHttp.axiosInstance.interceptors.request.use(
      async (config: PureHttpRequestConfig): Promise<any> => {
        // 优先判断post/get等方法是否传入回调，否则执行初始化设置等回调
        if (typeof config.beforeRequestCallback === "function") {
          config.beforeRequestCallback(config);
          return config;
        }
        if (PureHttp.initConfig.beforeRequestCallback) {
          PureHttp.initConfig.beforeRequestCallback(config);
          return config;
        }

        // 检查是否在白名单中
        if (PureHttp.isWhiteListUrl(config.url)) {
          return config;
        }

        return new Promise(resolve => {
          const data = getToken();
          if (data) {
            // 确保data.accessToken存在
            if (data.accessToken) {
              const now = new Date().getTime();
              const expires = data.expires;
              if (typeof expires === "number") {
                // 提前10秒刷新token，避免网络延迟导致的过期问题
                const isExpired = expires - now <= 10000;
                if (isExpired) {
                  if (!PureHttp.isRefreshing && data.refreshToken) {
                    // 处理token刷新
                    PureHttp.handleTokenRefresh(config, resolve, data);
                  } else if (!data.refreshToken) {
                    // 没有refreshToken，跳转到登录页
                    PureHttp.handleLogout();
                    return Promise.reject(
                      new Error("没有刷新令牌，需要重新登录")
                    );
                  } else {
                    // 正在刷新token，将当前请求加入等待队列
                    resolve(PureHttp.retryOriginalRequest(config));
                  }
                } else {
                  // token未过期，直接使用
                  config.headers["Authorization"] = formatToken(
                    data.accessToken
                  );
                  resolve(config);
                }
              } else {
                // expires格式不正确，直接使用token
                config.headers["Authorization"] = formatToken(data.accessToken);
                resolve(config);
              }
            } else if (data.refreshToken) {
              // 没有accessToken，但是有refreshToken，尝试刷新token
              if (!PureHttp.isRefreshing) {
                PureHttp.handleTokenRefresh(config, resolve, data);
              } else {
                resolve(PureHttp.retryOriginalRequest(config));
              }
            } else {
              // 没有accessToken/refreshToken，跳转到登录页
              PureHttp.handleLogout();
              return Promise.reject(new Error("没有访问令牌，需要重新登录"));
            }
          } else {
            // 没有token信息，跳转到登录页
            if (config.url && !PureHttp.isWhiteListUrl(config.url)) {
              PureHttp.handleLogout();
            }
            resolve(config);
          }
        });
      },
      error => {
        console.error("请求拦截器错误:", error);
        return Promise.reject(error);
      }
    );
  }

  /** 响应拦截 */
  private httpInterceptorsResponse(): void {
    const instance = PureHttp.axiosInstance;
    instance.interceptors.response.use(
      (response: PureHttpResponse) => {
        const $config = response.config;
        // 优先判断post/get等方法是否传入回调，否则执行初始化设置等回调
        if (typeof $config.beforeResponseCallback === "function") {
          $config.beforeResponseCallback(response);
          return response.data;
        }
        if (PureHttp.initConfig.beforeResponseCallback) {
          PureHttp.initConfig.beforeResponseCallback(response);
          return response.data;
        }
        return response.data;
      },
      (error: PureHttpError) => {
        const $error = error;
        $error.isCancelRequest = Axios.isCancel($error);

        // 处理401未授权错误
        if ($error.response?.status === 401) {
          const data = getToken();
          // 如果有refreshToken，尝试刷新token
          if (data?.refreshToken && !PureHttp.isRefreshing) {
            PureHttp.isRefreshing = true;
            return useUserStoreHook()
              .handRefreshToken({ refreshToken: data.refreshToken })
              .then(res => {
                const token = res.data.accessToken;
                // 重新设置请求头
                if ($error.config) {
                  $error.config.headers["Authorization"] = formatToken(token);
                  // 重新发起请求
                  return PureHttp.axiosInstance($error.config);
                }
                return Promise.reject($error);
              })
              .catch(refreshError => {
                console.error("刷新token失败:", refreshError);
                // 刷新失败，清除token并跳转到登录页
                PureHttp.handleLogout();
                return Promise.reject(refreshError);
              })
              .finally(() => {
                PureHttp.isRefreshing = false;
              });
          } else {
            // 没有refreshToken或正在刷新，跳转到登录页
            if (!PureHttp.isRefreshing) {
              PureHttp.handleLogout();
            }
          }
        }

        // 处理400错误和其他业务错误
        if ($error.response?.status === 400 || $error.response?.status >= 500) {
          console.error("API请求错误:", {
            url: $error.config?.url,
            status: $error.response?.status,
            data: $error.response?.data
          });
        }

        // 所有的响应异常 区分来源为取消请求/非取消请求
        return Promise.reject($error);
      }
    );
  }

  /** 通用请求工具函数 */
  public request<T>(
    method: RequestMethods,
    url: string,
    param?: AxiosRequestConfig,
    axiosConfig?: PureHttpRequestConfig
  ): Promise<T> {
    const config = {
      method,
      url,
      ...param,
      ...axiosConfig
    } as PureHttpRequestConfig;

    // 单独处理自定义请求/响应回调
    return new Promise((resolve, reject) => {
      PureHttp.axiosInstance
        .request(config)
        .then((response: undefined) => {
          resolve(response);
        })
        .catch(error => {
          reject(error);
        });
    });
  }

  /** 单独抽离的`post`工具函数 */
  public post<T, P>(
    url: string,
    params?: AxiosRequestConfig<P>,
    config?: PureHttpRequestConfig
  ): Promise<T> {
    return this.request<T>("post", url, params, config);
  }

  /** 单独抽离的`get`工具函数 */
  public get<T, P>(
    url: string,
    params?: AxiosRequestConfig<P>,
    config?: PureHttpRequestConfig
  ): Promise<T> {
    return this.request<T>("get", url, params, config);
  }

  /** 单独抽离的`put`工具函数 */
  public put<T, P>(
    url: string,
    params?: AxiosRequestConfig<P>,
    config?: PureHttpRequestConfig
  ): Promise<T> {
    return this.request<T>("put", url, params, config);
  }

  /** 单独抽离的`delete`工具函数 */
  public delete<T, P>(
    url: string,
    params?: AxiosRequestConfig<P>,
    config?: PureHttpRequestConfig
  ): Promise<T> {
    return this.request<T>("delete", url, params, config);
  }

  /** 单独抽离的`patch`工具函数 */
  public patch<T, P>(
    url: string,
    params?: AxiosRequestConfig<P>,
    config?: PureHttpRequestConfig
  ): Promise<T> {
    return this.request<T>("patch", url, params, config);
  }

  /** OAuth token交换专用方法 */
  public oauthToken<T>(
    url: string,
    params: any,
    config?: PureHttpRequestConfig
  ): Promise<T> {
    // OAuth请求需要使用form-urlencoded格式
    // 手动序列化参数为form-urlencoded字符串
    const formParams = new URLSearchParams(params).toString();

    const oauthRequestConfig: PureHttpRequestConfig = {
      method: "post",
      url,
      data: formParams,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json"
      },
      ...config
    };
    return this.request<T>("post", url, oauthRequestConfig);
  }

  /** OAuth授权码交换专用方法 */
  public oauthCodeExchange<T>(
    code: string,
    redirectUri: string,
    clientId: string,
    clientSecret: string,
    scope?: string
  ): Promise<T> {
    const params = {
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
      ...(scope && { scope })
    };
    // 使用绝对URL，不经过Vite代理
    const tokenEndpoint = `${oauthConfig.serverUrl}/connect/token`;
    return this.oauthToken<T>(tokenEndpoint, params);
  }

  /** OAuth刷新令牌专用方法 */
  public oauthRefreshToken<T>(
    refreshToken: string,
    clientId: string,
    clientSecret: string,
    scope?: string
  ): Promise<T> {
    const params = {
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      ...(scope && { scope })
    };
    // 使用绝对URL，不经过Vite代理
    const tokenEndpoint = `${oauthConfig.serverUrl}/connect/token`;
    return this.oauthToken<T>(tokenEndpoint, params);
  }
}

export const http = new PureHttp();
