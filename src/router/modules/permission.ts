export default {
  path: "/permission",
  redirect: "/permission/page",
  meta: {
    title: "权限管理",
    icon: "ep:lock",
    showLink: true,
    rank: 1
  },
  children: [
    {
      path: "/permission/page",
      name: "PermissionPage",
      component: () => import("@/views/permission/page/index.vue"),
      meta: {
        title: "页面权限"
      }
    },
    {
      path: "/permission/button",
      name: "PermissionButton",
      component: () => import("@/views/permission/button/index.vue"),
      meta: {
        title: "按钮权限"
      }
    }
  ]
} satisfies RouteConfigsTable;
