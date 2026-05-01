<template>
  <div class="r-init--page">
    <div class="r-init--container">
      <!-- 左侧装饰 -->
      <div class="r-init--banner">
        <div class="r-init--banner_content">
          <img src="https://static.codemao.cn/community/shequ_logo.png" alt="编程狗社区" class="r-init--logo">
          <h2>欢迎使用编程狗社区</h2>
          <p>第一个使用编程猫登录的用户将自动成为管理员</p>
          <div class="r-init--steps">
            <div class="r-init--step">
              <span class="r-init--step_num">1</span>
              <span>使用编程猫账号登录</span>
            </div>
            <div class="r-init--step">
              <span class="r-init--step_num">2</span>
              <span>第一个登录用户自动成为管理员</span>
            </div>
            <div class="r-init--step">
              <span class="r-init--step_num">3</span>
              <span>开始管理社区内容</span>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 右侧内容 -->
      <div class="r-init--form_wrapper">
        <div class="r-init--form_header">
          <h3>开始使用</h3>
          <p>请使用编程猫账号登录系统</p>
        </div>
        
        <div class="r-init--info">
          <el-alert
            title="管理员说明"
            type="info"
            :closable="false"
            show-icon
          >
            <template #default>
              <p>第一个使用编程猫登录的用户将自动成为<strong>超级管理员</strong>。</p>
              <p style="margin-top: 8px;">后续管理员需要由超级管理员在后台设置。</p>
            </template>
          </el-alert>
        </div>
        
        <div class="r-init--actions">
          <el-button 
            type="primary" 
            size="large" 
            class="r-init--submit_btn"
            @click="goToLogin"
          >
            前往登录
          </el-button>
        </div>
        
        <div class="r-init--form_footer">
          <p>已有账户？<router-link to="/login">直接登录</router-link></p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'

const router = useRouter()

const goToLogin = () => {
  router.push('/login')
}
</script>

<style lang="scss" scoped>
$primary-color: #FEC433;
$primary-hover: #FFD700;
$primary-light: #FFF9E6;
$text-color: #333;
$text-secondary: #666;
$text-muted: #999;

.r-init--page {
  min-height: calc(100vh - 60px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 24px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.r-init--container {
  display: flex;
  max-width: 900px;
  width: 100%;
  background: #fff;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
  
  @media (max-width: 768px) {
    flex-direction: column;
  }
}

.r-init--banner {
  flex: 1;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 60px 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  
  @media (max-width: 768px) {
    padding: 40px 24px;
  }
  
  .r-init--banner_content {
    text-align: center;
    color: #fff;
    
    .r-init--logo {
      height: 48px;
      margin-bottom: 24px;
    }
    
    h2 {
      font-size: 28px;
      font-weight: 600;
      margin: 0 0 12px;
    }
    
    p {
      font-size: 16px;
      opacity: 0.9;
      margin: 0 0 40px;
    }
  }
  
  .r-init--steps {
    display: flex;
    flex-direction: column;
    gap: 16px;
    
    .r-init--step {
      display: flex;
      align-items: center;
      gap: 12px;
      text-align: left;
      
      .r-init--step_num {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: rgba(255,255,255,0.2);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        font-weight: 600;
      }
      
      span:last-child {
        font-size: 14px;
        opacity: 0.9;
      }
    }
  }
}

.r-init--form_wrapper {
  width: 380px;
  padding: 60px 40px;
  flex-shrink: 0;
  
  @media (max-width: 768px) {
    width: 100%;
    padding: 40px 24px;
  }
  
  .r-init--form_header {
    text-align: center;
    margin-bottom: 32px;
    
    h3 {
      font-size: 24px;
      font-weight: 600;
      color: $text-color;
      margin: 0 0 8px;
    }
    
    p {
      font-size: 14px;
      color: $text-muted;
      margin: 0;
    }
  }
  
  .r-init--info {
    margin-bottom: 24px;
    
    :deep(.el-alert) {
      padding: 16px;
      
      p {
        margin: 0;
        font-size: 14px;
        line-height: 1.6;
      }
      
      strong {
        color: #409eff;
      }
    }
  }
  
  .r-init--actions {
    margin-bottom: 24px;
  }
  
  .r-init--submit_btn {
    width: 100%;
    height: 48px;
    font-size: 16px;
    border-radius: 8px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border: none;
    color: #fff;
    font-weight: 500;
    
    &:hover {
      background: linear-gradient(135deg, #5a6fd6 0%, #6a4190 100%);
    }
  }
  
  .r-init--form_footer {
    text-align: center;
    
    p {
      font-size: 14px;
      color: $text-muted;
      margin: 0;
      
      a {
        color: #667eea;
        text-decoration: none;
        font-weight: 500;
        
        &:hover {
          text-decoration: underline;
        }
      }
    }
  }
}
</style>
