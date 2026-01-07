<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { message } from "@/utils/message";
import { exchangeCodeForToken, getUserInfo } from "@/api/oauth";
import {
  parseCallbackUrl,
  validateState,
  clearOAuthSession
} from "@/utils/oauth";
import { setToken, removeToken, type DataInfo, userKey } from "@/utils/auth";
import { storageLocal } from "@pureadmin/utils";
import { useUserStoreHook } from "@/store/modules/user";
import { initRouter, getTopMenu } from "@/router/utils";
import Motion from "./utils/motion";
import { useNav } from "@/layout/hooks/useNav";
import { bg, illustration } from "./utils/static";

const router = useRouter();
const loading = ref(true);
const error = ref<string | null>(null);
const { title } = useNav();

const handleReload = () => {
  window.location.reload();
};

onMounted(async () => {
  try {
    const url = window.location.href;
    const {
      code,
      state,
      error: oauthError,
      errorDescription
    } = parseCallbackUrl(url);

    if (oauthError) {
      error.value = errorDescription || oauthError;
      loading.value = false;
      oauthErrorCallBack();
      return;
    }

    if (!code) {
      error.value = "未收到授权码";
      loading.value = false;
      oauthErrorCallBack();
      return;
    }

    if (!state || !validateState(state)) {
      error.value = "State 验证失败，可能存在安全风险";
      loading.value = false;
      oauthErrorCallBack();
      return;
    }

    const tokenResponse = await exchangeCodeForToken({ code });

    const expires = new Date(Date.now() + tokenResponse.expires_in * 1000);

    const tokenData: DataInfo<Date> = {
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token,
      expires: expires
    };

    setToken(tokenData);

    try {
      const userInfo = await getUserInfo();

      useUserStoreHook().SET_AVATAR("");
      useUserStoreHook().SET_USERNAME(userInfo.name);
      useUserStoreHook().SET_NICKNAME(userInfo.name);
      useUserStoreHook().SET_ROLES(userInfo.roles || []);
      useUserStoreHook().SET_PERMS([]);

      storageLocal().setItem(userKey, {
        refreshToken: tokenResponse.refresh_token,
        expires: expires.getTime(),
        avatar: "",
        username: userInfo.name,
        nickname: userInfo.name,
        roles: userInfo.roles || [],
        permissions: []
      });

      await initRouter();

      const topMenu = getTopMenu(true);
      await router.push(topMenu.path);

      message("登录成功", { type: "success" });
    } catch (userInfoError) {
      console.error("获取用户信息失败:", userInfoError);
      error.value = "获取用户信息失败，请重试";
      oauthErrorCallBack();
    }
  } catch (err) {
    console.error("OAuth 回调处理失败:", err);
    error.value = err instanceof Error ? err.message : "登录失败，请重试";
    oauthErrorCallBack();
  } finally {
    loading.value = false;
    clearOAuthSession();
  }
});

const oauthErrorCallBack = () => {
  // 清理登录相关的缓存信息
  removeToken();
  useUserStoreHook().SET_AVATAR("");
  useUserStoreHook().SET_USERNAME("");
  useUserStoreHook().SET_NICKNAME("");
  useUserStoreHook().SET_ROLES([]);
  useUserStoreHook().SET_PERMS([]);
  storageLocal().removeItem(userKey);
};

const handleBackToLogin = () => {
  router.push("/login");
};
</script>

<template>
  <div class="select-none">
    <img :src="bg" class="wave" />
    <div class="login-container">
      <div class="img">
        <component :is="illustration" />
      </div>
      <div class="login-box">
        <div class="login-form">
          <Motion>
            <h2 class="outline-hidden">{{ title }}</h2>
          </Motion>

          <!-- 加载状态 -->
          <div v-if="loading" class="callback-content">
            <Motion :delay="100">
              <div class="loading-state">
                <el-icon class="loading-icon" size="60" color="#409eff">
                  <Loading />
                </el-icon>
                <h3 class="state-title">正在登录</h3>
                <p class="state-description">我们正在为您准备账户信息...</p>
              </div>
            </Motion>
          </div>

          <!-- 错误状态 -->
          <div v-else-if="error" class="callback-content">
            <Motion :delay="100">
              <div class="error-state">
                <el-icon class="error-icon" size="60" color="#f56c6c">
                  <CloseCircle />
                </el-icon>
                <h3 class="state-title">登录遇到问题</h3>
                <el-alert
                  :title="error"
                  type="error"
                  show-icon
                  class="mt-4 error-message"
                  :closable="false"
                />

                <div class="action-buttons mt-6">
                  <el-button
                    type="primary"
                    size="default"
                    class="w-full mr-2"
                    @click="handleBackToLogin"
                  >
                    返回登录页
                  </el-button>
                  <el-button
                    size="default"
                    class="w-full ml-2"
                    @click="handleReload"
                  >
                    重试
                  </el-button>
                </div>
              </div>
            </Motion>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@import url("@/style/login.css");

.callback-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 20px 0;
}

.loading-state,
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  text-align: center;
}

.loading-icon,
.error-icon {
  margin-bottom: 20px;
}

.state-title {
  margin-bottom: 12px;
  font-size: 20px;
  font-weight: 600;
  color: #303133;
}

.state-description {
  margin-bottom: 20px;
  font-size: 14px;
  color: #606266;
}

.error-message {
  width: 100%;
}

.action-buttons {
  display: flex;
  gap: 12px;
  width: 100%;
}
</style>
