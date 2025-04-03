// ==UserScript==
// @name         webAI聊天问题列表导航-测试版
// @namespace    http://tampermonkey.net/
// @version      3.1-test
// @description  测试版：通过点击按钮显示用户问题列表，支持导航、分页、排序，详细日志和配置测试功能
// @author       yutao
// @match        https://grok.com/chat/*
// @match        https://github.com/copilot/*
// @match        https://yuanbao.tencent.com/chat/*
// @match        https://chat.qwenlm.ai/c/*
// @match        https://chat.qwen.ai/c/*
// @match        https://copilot.microsoft.com/chats/*
// @match        https://chatgpt.com/c/*
// @match        https://chat.deepseek.com/a/chat/*
// @match        https://tongyi.aliyun.com/*
// @match        https://www.doubao.com/*
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  const config = {
    "www.doubao.com": {
      messageSelector: 'div[data-testid="send_message"]',
      textSelector: 'div[data-testid="message_text_content"]',
      userCondition: (element) => true,
      scrollContainerSelector:
        'div[class*="scrollable-"][class*="show-scrollbar-"]',
    },

    "grok.com": {
      messageSelector: "div.message-bubble",
      textSelector: "span.whitespace-pre-wrap",
      userCondition: (element) =>
        element.classList.contains("bg-foreground") &&
        window.getComputedStyle(element).backgroundColor !==
          "rgb(224, 247, 250)",
      scrollContainerSelector: "div.overflow-y-auto, div.chat-messages",
    },
    "github.com": {
      messageSelector:
        "div.UserMessage-module__container--cAvvK.ChatMessage-module__userMessage--xvIFp",
      textSelector: null,
      userCondition: (element) =>
        element.classList.contains("ChatMessage-module__userMessage--xvIFp"),
      scrollContainerSelector:
        'div.overflow-y-auto, div[class*="chat-container"]',
    },
    "yuanbao.tencent.com": {
      messageSelector: "div.agent-chat__bubble__content",
      textSelector: "div.hyc-content-text",
      userCondition: (element) => true,
      scrollContainerSelector:
        'div.overflow-auto, div[class*="message-container"]',
    },
    "chat.qwenlm.ai": {
      messageSelector: "div.rounded-3xl.bg-gray-50.dark\\:bg-gray-850",
      textSelector: "p",
      userCondition: (element) => true,
      scrollContainerSelector:
        'div.overflow-y-auto, div[class*="chat-content"]',
    },
    "chat.qwen.ai": {
      messageSelector:
        'div.dark\\:bg-gray-850, div[class*="message-item"], div[class*="user-message"], div.bg-blue-100',
      textSelector:
        'div[class*="markdown-content"], p, div[class*="text"], span[class*="content"]',
      userCondition: (element) => {
        // 使用更精确的条件识别用户消息，避免重复
        return (
          element.classList.contains("bg-blue-100") ||
          element.querySelector('[class*="user-message"]') !== null ||
          element.getAttribute("data-message-author-role") === "user"
        );
      },
      scrollContainerSelector:
        '#messages-container, div[class*="overflow-auto"][class*="flex-col"]',
    },
    "copilot.microsoft.com": {
      messageSelector: "div.self-end.rounded-2xl",
      textSelector: null,
      userCondition: (element) => element.classList.contains("self-end"),
      scrollContainerSelector:
        'div.overflow-auto, div[class*="chat-container"]',
    },
    "chatgpt.com": {
      messageSelector: "div.rounded-3xl.bg-token-message-surface",
      textSelector: "div.whitespace-pre-wrap",
      userCondition: (element) => true,
      scrollContainerSelector: 'div.overflow-y-auto, main[class*="flex-col"]',
    },
    "chat.deepseek.com": {
      messageSelector: "div.fbb737a4",
      textSelector: null,
      userCondition: (element) => true,
      scrollContainerSelector: 'div.overflow-y-auto, div[class*="scroll"]',
    },
  };

  // 创建日志工具
  const logger = {
    debug: function (message, ...args) {
      console.log(`%c[DEBUG] ${message}`, "color: #9E9E9E", ...args);
    },
    info: function (message, ...args) {
      console.log(`%c[INFO] ${message}`, "color: #2196F3", ...args);
    },
    success: function (message, ...args) {
      console.log(`%c[SUCCESS] ${message}`, "color: #4CAF50", ...args);
    },
    warn: function (message, ...args) {
      console.log(`%c[WARN] ${message}`, "color: #FF9800", ...args);
    },
    error: function (message, ...args) {
      console.log(`%c[ERROR] ${message}`, "color: #F44336", ...args);
    },
    group: function (name) {
      console.group(`%c[GROUP] ${name}`, "color: #673AB7; font-weight: bold");
    },
    groupEnd: function () {
      console.groupEnd();
    },
    table: function (data) {
      console.table(data);
    },
  };

  // 配置对象，定义不同网站的聊天消息选择器和条件

  // 获取当前域名并选择配置
  const hostname = window.location.hostname;
  logger.info("当前网站域名:", hostname);

  const currentConfig = config[hostname] || {
    messageSelector: "div[class*=message], div[class*=chat], div[class*=user]",
    textSelector: null,
    userCondition: (element) => true,
    scrollContainerSelector:
      '#messages-container, div[class*="overflow-auto"][class*="flex-col"]',
  };

  logger.info("使用配置:", currentConfig);

  // 分页相关变量
  let questions = [];
  const pageSize = 10;
  let currentPage = 1;
  let isReversed = false;
  let isLoading = false; // 加载状态标志

  // 创建美化后的浮动按钮
  const button = document.createElement("button");
  button.textContent = "问题列表";
  button.style.position = "fixed";
  button.style.bottom = "20px";
  button.style.right = "20px";
  button.style.zIndex = "1000";
  button.style.padding = "10px 15px";
  button.style.background = "linear-gradient(135deg, #007BFF, #00C4FF)";
  button.style.color = "#fff";
  button.style.border = "none";
  button.style.borderRadius = "8px";
  button.style.boxShadow = "0 2px 4px rgba(0,0,0,0.2)";
  button.style.cursor = "pointer";
  button.style.fontFamily = "Arial, sans-serif";
  button.style.fontSize = "14px";
  button.style.transition = "transform 0.2s, box-shadow 0.2s";
  button.addEventListener("mouseover", () => {
    button.style.transform = "scale(1.05)";
    button.style.boxShadow = "0 4px 8px rgba(0,0,0,0.3)";
  });
  button.addEventListener("mouseout", () => {
    button.style.transform = "scale(1)";
    button.style.boxShadow = "0 2px 4px rgba(0,0,0,0.2)";
  });
  document.body.appendChild(button);
  logger.debug("创建浮动按钮完成");

  // 创建美化后的悬浮窗
  const floatWindow = document.createElement("div");
  floatWindow.style.position = "fixed";
  floatWindow.style.bottom = "70px";
  floatWindow.style.right = "20px";
  floatWindow.style.width = "320px";
  floatWindow.style.maxHeight = "420px";
  floatWindow.style.background = "#ffffff";
  floatWindow.style.border = "1px solid #e0e0e0";
  floatWindow.style.borderRadius = "10px";
  floatWindow.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
  floatWindow.style.padding = "15px";
  floatWindow.style.overflowY = "auto";
  floatWindow.style.display = "none";
  floatWindow.style.zIndex = "1000";
  floatWindow.style.fontFamily = "Arial, sans-serif";
  floatWindow.style.transition = "opacity 0.2s";
  document.body.appendChild(floatWindow);
  logger.debug("创建悬浮窗完成");

  // 创建加载历史记录按钮
  const loadHistoryButton = document.createElement("button");
  loadHistoryButton.textContent = "加载历史记录";
  loadHistoryButton.style.marginBottom = "10px";
  loadHistoryButton.style.marginRight = "10px";
  loadHistoryButton.style.padding = "5px 10px";
  loadHistoryButton.style.background = "#4CAF50";
  loadHistoryButton.style.color = "#fff";
  loadHistoryButton.style.border = "none";
  loadHistoryButton.style.borderRadius = "4px";
  loadHistoryButton.style.cursor = "pointer";
  loadHistoryButton.style.fontSize = "12px";
  loadHistoryButton.style.transition = "background 0.2s";
  loadHistoryButton.addEventListener("mouseover", () => {
    if (!isLoading) loadHistoryButton.style.background = "#45a049";
  });
  loadHistoryButton.addEventListener("mouseout", () => {
    if (!isLoading) loadHistoryButton.style.background = "#4CAF50";
  });

  // 创建顶部按钮容器
  const topButtonContainer = document.createElement("div");
  topButtonContainer.style.display = "flex";
  topButtonContainer.style.justifyContent = "space-between";
  topButtonContainer.style.marginBottom = "15px";

  // 创建排序切换按钮
  const sortButton = document.createElement("button");
  sortButton.textContent = "正序";
  sortButton.style.padding = "5px 10px";
  sortButton.style.background = "#007BFF";
  sortButton.style.color = "#fff";
  sortButton.style.border = "none";
  sortButton.style.borderRadius = "4px";
  sortButton.style.cursor = "pointer";
  sortButton.style.fontSize = "12px";
  sortButton.style.transition = "background 0.2s";
  sortButton.addEventListener("mouseover", () => {
    sortButton.style.background = "#0069d9";
  });
  sortButton.addEventListener("mouseout", () => {
    sortButton.style.background = "#007BFF";
  });

  // 创建信息按钮
  const infoButton = document.createElement("button");
  infoButton.textContent = "ℹ️";
  infoButton.title = "显示调试信息";
  infoButton.style.marginBottom = "10px";
  infoButton.style.marginLeft = "5px";
  infoButton.style.padding = "5px 8px";
  infoButton.style.background = "#f0f0f0";
  infoButton.style.color = "#333";
  infoButton.style.border = "none";
  infoButton.style.borderRadius = "4px";
  infoButton.style.cursor = "pointer";
  infoButton.style.fontSize = "12px";

  // 创建配置测试按钮 - 新增
  const configTestButton = document.createElement("button");
  configTestButton.textContent = "配置测试";
  configTestButton.style.marginBottom = "10px";
  configTestButton.style.marginRight = "10px";
  configTestButton.style.padding = "5px 10px";
  configTestButton.style.background = "#FF5722";
  configTestButton.style.color = "#fff";
  configTestButton.style.border = "none";
  configTestButton.style.borderRadius = "4px";
  configTestButton.style.cursor = "pointer";
  configTestButton.style.fontSize = "12px";
  configTestButton.style.transition = "background 0.2s";
  configTestButton.addEventListener("mouseover", () => {
    configTestButton.style.background = "#E64A19";
  });
  configTestButton.addEventListener("mouseout", () => {
    configTestButton.style.background = "#FF5722";
  });
  logger.debug("创建按钮完成");

  // 将按钮添加到容器中
  topButtonContainer.appendChild(loadHistoryButton);
  topButtonContainer.appendChild(configTestButton); // 新增
  topButtonContainer.appendChild(infoButton);
  topButtonContainer.appendChild(sortButton);
  floatWindow.appendChild(topButtonContainer);
  logger.debug("添加按钮到容器完成");

  // 创建分页控件
  const paginationContainer = document.createElement("div");
  paginationContainer.style.display = "flex";
  paginationContainer.style.justifyContent = "center";
  paginationContainer.style.marginTop = "10px";
  paginationContainer.style.gap = "5px";

  // 问题列表容器
  const listContainer = document.createElement("ul");
  listContainer.style.listStyle = "none";
  listContainer.style.padding = "0";
  listContainer.style.margin = "0";
  floatWindow.appendChild(listContainer);
  floatWindow.appendChild(paginationContainer);

  // 创建问题计数显示区域
  const questionCountDisplay = document.createElement("div");
  questionCountDisplay.style.fontSize = "12px";
  questionCountDisplay.style.color = "#666";
  questionCountDisplay.style.textAlign = "center";
  questionCountDisplay.style.margin = "5px 0 10px 0";
  floatWindow.insertBefore(questionCountDisplay, listContainer);
  logger.debug("创建UI元素完成");

  // 更新问题计数显示
  function updateQuestionCountDisplay() {
    questionCountDisplay.textContent = `共找到 ${questions.length} 个问题`;
    logger.debug(`更新问题计数: ${questions.length}`);
  }

  // 获取文本内容的辅助函数
  function getTextContent(element) {
    return element ? element.textContent.trim() : "";
  }

  // 添加查找所有滚动容器的函数
  function findAllScrollContainers() {
    logger.group("查找滚动容器");
    const scrollContainers = [];

    // 查找具有滚动能力的容器
    logger.debug("开始查找可滚动元素...");
    document.querySelectorAll("*").forEach((el) => {
      try {
        if (el.scrollHeight > el.clientHeight + 10 && el.clientHeight > 100) {
          const style = window.getComputedStyle(el);
          if (
            style.overflow === "auto" ||
            style.overflow === "scroll" ||
            style.overflowY === "auto" ||
            style.overflowY === "scroll"
          ) {
            scrollContainers.push(el);
            logger.debug(`找到可滚动元素: ${el.tagName}.${el.className}`);
          }
        }
      } catch (e) {
        logger.warn(`检查元素时出错: ${e.message}`);
      }
    });

    // 按照容器大小排序，优先使用大的容器
    scrollContainers.sort((a, b) => {
      const aArea = a.clientWidth * a.clientHeight;
      const bArea = b.clientWidth * b.clientHeight;
      return bArea - aArea; // 从大到小排序
    });

    logger.info(`总共找到 ${scrollContainers.length} 个可滚动容器`);
    logger.groupEnd();
    return scrollContainers;
  }

  // 查找所有用户问题并去重的函数
  function findAllQuestionsWithDeduplication() {
    logger.group("查找用户问题");

    const chatContainer =
      document.querySelector(".chat-container, #chat, main, article") ||
      document.body;
    logger.info("使用聊天容器:", chatContainer);

    const potentialMessages = chatContainer.querySelectorAll(
      currentConfig.messageSelector
    );
    logger.info(
      `使用选择器 "${currentConfig.messageSelector}" 找到 ${potentialMessages.length} 个潜在消息元素`
    );

    // 临时存储所有找到的问题
    const foundQuestions = [];
    const seenTexts = new Set(); // 用于去重

    // 详细记录每个元素的处理情况
    const processedElements = [];

    for (let i = 0; i < potentialMessages.length; i++) {
      const element = potentialMessages[i];
      const textElement = currentConfig.textSelector
        ? element.querySelector(currentConfig.textSelector)
        : element;
      const text = getTextContent(textElement);

      // 记录元素处理信息
      const elementInfo = {
        index: i,
        hasText: !!text,
        textLength: text ? text.length : 0,
        isUserMessage: currentConfig.userCondition(element),
        text: text
          ? text.length > 30
            ? text.substring(0, 30) + "..."
            : text
          : "",
        selected: false,
        reason: "",
      };

      // 如果文本内容有效且符合用户消息条件
      if (text && text.length > 2 && currentConfig.userCondition(element)) {
        // 使用文本内容进行去重
        if (!seenTexts.has(text)) {
          seenTexts.add(text);
          foundQuestions.push({ element, text });
          elementInfo.selected = true;
          elementInfo.reason = "有效用户消息";
        } else {
          elementInfo.reason = "重复消息，已跳过";
        }
      } else {
        if (!text) {
          elementInfo.reason = "无文本内容";
        } else if (text.length <= 2) {
          elementInfo.reason = "文本内容太短";
        } else if (!currentConfig.userCondition(element)) {
          elementInfo.reason = "不符合用户消息条件";
        }
      }

      processedElements.push(elementInfo);
    }

    // 输出元素处理详情
    logger.debug("元素处理详情:");
    logger.table(processedElements);

    // 更新全局问题列表
    questions = foundQuestions;
    logger.success(`找到 ${questions.length} 个去重后的问题`);

    // 确保排序正确
    if (isReversed) {
      questions.reverse();
      logger.debug("已应用倒序排序");
    }

    // 更新界面
    updateQuestionCountDisplay();
    renderPage(currentPage);
    updatePagination();

    logger.groupEnd();
  }

  // 使找到的问题定位在屏幕中
  function renderPage(page) {
    logger.debug(`渲染页面: 第${page}页`);
    // 清空列表容器
    while (listContainer.firstChild) {
      listContainer.removeChild(listContainer.firstChild);
    }

    const start = (page - 1) * pageSize;
    const end = page * pageSize;
    const pageQuestions = questions.slice(start, end);
    logger.debug(
      `显示问题: ${start + 1} 到 ${Math.min(end, questions.length)}`
    );

    pageQuestions.forEach((q, idx) => {
      const listItem = document.createElement("li");
      const shortText =
        q.text.substring(0, 20) + (q.text.length > 20 ? "..." : "");
      listItem.textContent = `${
        isReversed ? questions.length - start - idx : start + idx + 1
      }: ${shortText}`;
      listItem.style.padding = "8px 12px";
      listItem.style.cursor = "pointer";
      listItem.style.fontSize = "13px";
      listItem.style.color = "#333";
      listItem.style.whiteSpace = "nowrap";
      listItem.style.overflow = "hidden";
      listItem.style.textOverflow = "ellipsis";
      listItem.style.borderBottom = "1px solid #f0f0f0";
      listItem.style.transition = "background 0.2s";
      listItem.style.borderRadius = "4px";
      listItem.title = q.text;
      listItem.addEventListener("mouseover", () => {
        listItem.style.background = "#f5f5f5";
      });
      listItem.addEventListener("mouseout", () => {
        listItem.style.background = "none";
      });
      listItem.addEventListener("click", () => {
        logger.debug(`点击问题: ${idx + 1} - ${shortText}`);
        q.element.scrollIntoView({ behavior: "smooth", block: "start" });
        floatWindow.style.opacity = "0";
        setTimeout(() => (floatWindow.style.display = "none"), 200);
        button.textContent = "问题列表";
      });
      listContainer.appendChild(listItem);
    });
  }

  // 更新分页控件
  function updatePagination() {
    logger.debug("更新分页控件");
    // 清空分页容器
    while (paginationContainer.firstChild) {
      paginationContainer.removeChild(paginationContainer.firstChild);
    }

    const totalPages = Math.ceil(questions.length / pageSize);
    logger.debug(`总页数: ${totalPages}`);

    if (totalPages) {
      const prevButton = document.createElement("button");
      prevButton.textContent = "上一页";
      prevButton.style.padding = "5px 10px";
      prevButton.style.border = "none";
      prevButton.style.background = currentPage === 1 ? "#f0f0f0" : "#007BFF";
      prevButton.style.color = currentPage === 1 ? "#aaa" : "#fff";
      prevButton.style.cursor = currentPage === 1 ? "not-allowed" : "pointer";
      prevButton.style.borderRadius = "4px";
      prevButton.style.transition = "background 0.2s";
      prevButton.disabled = currentPage === 1;
      prevButton.addEventListener("click", () => {
        if (currentPage > 1) {
          currentPage--;
          logger.debug(`切换到第${currentPage}页`);
          renderPage(currentPage);
          updatePagination();
        }
      });
      paginationContainer.appendChild(prevButton);

      // 显示页码按钮，但限制最多显示5个
      const maxButtons = 5;
      let startPage = Math.max(
        1,
        Math.min(
          currentPage - Math.floor(maxButtons / 2),
          totalPages - maxButtons + 1
        )
      );
      if (startPage < 1) startPage = 1;
      const endPage = Math.min(startPage + maxButtons - 1, totalPages);

      if (startPage > 1) {
        const firstPageButton = document.createElement("button");
        firstPageButton.textContent = "1";
        firstPageButton.style.padding = "5px 10px";
        firstPageButton.style.border = "none";
        firstPageButton.style.background = "#f0f0f0";
        firstPageButton.style.color = "#333";
        firstPageButton.style.cursor = "pointer";
        firstPageButton.style.borderRadius = "4px";
        firstPageButton.style.transition = "background 0.2s";
        firstPageButton.addEventListener("click", () => {
          currentPage = 1;
          logger.debug("切换到第1页");
          renderPage(currentPage);
          updatePagination();
        });
        paginationContainer.appendChild(firstPageButton);

        if (startPage > 2) {
          const ellipsis = document.createElement("span");
          ellipsis.textContent = "...";
          ellipsis.style.padding = "5px";
          ellipsis.style.color = "#666";
          paginationContainer.appendChild(ellipsis);
        }
      }

      for (let i = startPage; i <= endPage; i++) {
        const pageButton = document.createElement("button");
        pageButton.textContent = i;
        pageButton.style.padding = "5px 10px";
        pageButton.style.border = "none";
        pageButton.style.background = currentPage === i ? "#007BFF" : "#f0f0f0";
        pageButton.style.color = currentPage === i ? "#fff" : "#333";
        pageButton.style.cursor = "pointer";
        pageButton.style.borderRadius = "4px";
        pageButton.style.transition = "background 0.2s";
        pageButton.addEventListener("click", () => {
          currentPage = i;
          logger.debug(`切换到第${i}页`);
          renderPage(currentPage);
          updatePagination();
        });
        paginationContainer.appendChild(pageButton);
      }

      if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
          const ellipsis = document.createElement("span");
          ellipsis.textContent = "...";
          ellipsis.style.padding = "5px";
          ellipsis.style.color = "#666";
          paginationContainer.appendChild(ellipsis);
        }

        const lastPageButton = document.createElement("button");
        lastPageButton.textContent = totalPages;
        lastPageButton.style.padding = "5px 10px";
        lastPageButton.style.border = "none";
        lastPageButton.style.background = "#f0f0f0";
        lastPageButton.style.color = "#333";
        lastPageButton.style.cursor = "pointer";
        lastPageButton.style.borderRadius = "4px";
        lastPageButton.style.transition = "background 0.2s";
        lastPageButton.addEventListener("click", () => {
          currentPage = totalPages;
          logger.debug(`切换到第${totalPages}页`);
          renderPage(currentPage);
          updatePagination();
        });
        paginationContainer.appendChild(lastPageButton);
      }

      const nextButton = document.createElement("button");
      nextButton.textContent = "下一页";
      nextButton.style.padding = "5px 10px";
      nextButton.style.border = "none";
      nextButton.style.background =
        currentPage === totalPages ? "#f0f0f0" : "#007BFF";
      nextButton.style.color = currentPage === totalPages ? "#aaa" : "#fff";
      nextButton.style.cursor =
        currentPage === totalPages ? "not-allowed" : "pointer";
      nextButton.style.borderRadius = "4px";
      nextButton.style.transition = "background 0.2s";
      nextButton.disabled = currentPage === totalPages;
      nextButton.addEventListener("click", () => {
        if (currentPage < totalPages) {
          currentPage++;
          logger.debug(`切换到第${currentPage}页`);
          renderPage(currentPage);
          updatePagination();
        }
      });
      paginationContainer.appendChild(nextButton);
    }
  }

  // 配置测试功能
  function testCurrentPageConfig() {
    logger.group("🛠️ 配置测试开始");
    logger.info("当前页面URL:", window.location.href);
    logger.info("当前域名:", hostname);

    // 记录页面元素信息
    const allElements = document.querySelectorAll("*");
    logger.info(`页面总元素数: ${allElements.length}`);

    // 测试不同选择器
    const testSelectors = [
      "div[class*=message]",
      "div[class*=chat]",
      "div[class*=user]",
      "div.message",
      ".message",
      ".chat-message",
      ".user-message",
      'div[role="listitem"]',
      "article",
      "div.bubble",
      "div.content",
    ];

    const selectorResults = {};

    testSelectors.forEach((selector) => {
      try {
        const elements = document.querySelectorAll(selector);
        selectorResults[selector] = elements.length;
      } catch (e) {
        selectorResults[selector] = `错误: ${e.message}`;
      }
    });

    logger.info("选择器测试结果:");
    logger.table(selectorResults);

    // 测试当前配置
    logger.info("当前配置:", currentConfig);
    const currentElements = document.querySelectorAll(
      currentConfig.messageSelector
    );
    logger.info(`当前选择器匹配到 ${currentElements.length} 个元素`);

    // 分析匹配到的元素
    const elementAnalysis = [];
    currentElements.forEach((el, index) => {
      if (index < 10) {
        // 只分析前10个元素以避免日志过长
        const textEl = currentConfig.textSelector
          ? el.querySelector(currentConfig.textSelector)
          : el;
        const text = getTextContent(textEl);
        const isUserMsg = currentConfig.userCondition(el);
        const classes = Array.from(el.classList).join(", ");
        elementAnalysis.push({
          index,
          isUserMsg,
          text: text.substring(0, 30) + (text.length > 30 ? "..." : ""),
          classes,
          tagName: el.tagName,
        });
      }
    });

    logger.info("匹配元素分析:");
    logger.table(elementAnalysis);

    // 生成该网站的最佳配置建议
    const userMsgCount =
      currentElements.length > 0
        ? Array.from(currentElements).filter((el) =>
            currentConfig.userCondition(el)
          ).length
        : 0;

    // 寻找可能的文本选择器
    const possibleTextSelectors = ["p", "div", "span", "pre", "code"]
      .map(
        (tag) =>
          `${tag}[class*=text], ${tag}[class*=content], ${tag}.text, ${tag}.content, ${tag}`
      )
      .concat(["[class*=text]", "[class*=content]", ".text", ".content"]);

    const textSelectorResults = {};
    if (currentElements.length > 0) {
      const sampleElement = currentElements[0];
      possibleTextSelectors.forEach((selector) => {
        try {
          const found = sampleElement.querySelectorAll(selector);
          textSelectorResults[selector] = found.length;
        } catch (e) {
          textSelectorResults[selector] = `错误: ${e.message}`;
        }
      });
    }

    logger.info("可能的文本选择器:");
    logger.table(textSelectorResults);

    // 生成建议配置
    let bestMessageSelector = currentConfig.messageSelector;
    let bestTextSelector = currentConfig.textSelector;

    // 根据测试结果找出匹配数最多的选择器
    let maxMatches = 0;
    for (const [selector, count] of Object.entries(selectorResults)) {
      if (typeof count === "number" && count > maxMatches && count < 1000) {
        // 避免选择太通用的选择器
        maxMatches = count;
        bestMessageSelector = selector;
      }
    }

    // 尝试生成一个更好的文本选择器
    let bestTextSelectorMatches = 0;
    for (const [selector, count] of Object.entries(textSelectorResults)) {
      if (typeof count === "number" && count > 0 && count < 20) {
        // 避免太多匹配
        bestTextSelectorMatches = count;
        bestTextSelector = selector;
      }
    }

    // 寻找最佳滚动容器选择器
    logger.info("分析最佳滚动容器...");
    const scrollContainers = findAllScrollContainers();
    const messageCount = {};
    let bestScrollContainer = null;
    let bestScrollSelector = "";
    let maxScrollContainerMessages = 0;

    // 分析每个滚动容器包含的消息数量
    scrollContainers.forEach((container, index) => {
      const count = container.querySelectorAll(bestMessageSelector).length;
      messageCount[index] = count;

      if (count > maxScrollContainerMessages) {
        maxScrollContainerMessages = count;
        bestScrollContainer = container;
      }
    });

    // 生成一个针对最佳滚动容器的选择器
    if (bestScrollContainer) {
      // 尝试通过ID选择
      if (bestScrollContainer.id) {
        bestScrollSelector = `#${bestScrollContainer.id}`;
      } else {
        // 尝试通过类名组合选择
        const classNames = Array.from(bestScrollContainer.classList);
        if (classNames.length > 0) {
          // 选择有代表性的类名
          const significantClasses = classNames.filter(
            (cls) =>
              cls.includes("scroll") ||
              cls.includes("container") ||
              cls.includes("chat") ||
              cls.includes("message") ||
              cls.includes("overflow") ||
              cls.includes("content")
          );

          if (significantClasses.length > 0) {
            bestScrollSelector = `${bestScrollContainer.tagName.toLowerCase()}[class*="${
              significantClasses[0]
            }"]`;

            // 如果有多个特征类，加上第二个特征
            if (significantClasses.length > 1) {
              bestScrollSelector += `[class*="${significantClasses[1]}"]`;
            }
          } else {
            // 如果没有特征类，使用第一个类
            bestScrollSelector = `${bestScrollContainer.tagName.toLowerCase()}.${
              classNames[0]
            }`;
          }
        } else {
          // 没有ID和类，使用默认选择器
          bestScrollSelector =
            '#messages-container, div[class*="overflow-auto"][class*="flex-col"]';
        }
      }
    } else {
      // 没有找到合适的滚动容器，使用默认选择器
      bestScrollSelector =
        '#messages-container, div[class*="overflow-auto"][class*="flex-col"]';
    }

    logger.info(`建议的滚动容器选择器: ${bestScrollSelector}`);

    const suggestedConfig = {
      messageSelector: bestMessageSelector,
      textSelector: bestTextSelector,
      userCondition: "function(element) { return true; }", // 简化起见
      scrollContainerSelector: bestScrollSelector,
    };

    logger.success("建议配置对象:", suggestedConfig);

    // 显示配置代码
    const configCode = `'${hostname}': {
    messageSelector: '${bestMessageSelector}',
    textSelector: ${bestTextSelector ? `'${bestTextSelector}'` : "null"},
    userCondition: (element) => true,
    scrollContainerSelector: '${bestScrollSelector}'
},`;

    logger.info("配置代码:");
    logger.info(configCode);

    // 创建一个可复制的配置信息弹窗
    const configInfo = `
网站域名: ${hostname}
页面地址: ${window.location.href}
匹配元素: ${currentElements.length}个 (其中用户消息: ${userMsgCount}个)

// 推荐配置代码:
'${hostname}': {
    messageSelector: '${bestMessageSelector}',
    textSelector: ${bestTextSelector ? `'${bestTextSelector}'` : "null"},
    userCondition: (element) => true,
    scrollContainerSelector: '${bestScrollSelector}'
},

// 测试的选择器结果:
${JSON.stringify(selectorResults, null, 2)}

// 当前配置:
${JSON.stringify(currentConfig, null, 2)}
`;

    const textarea = document.createElement("textarea");
    textarea.value = configInfo;
    textarea.style.width = "100%";
    textarea.style.height = "300px";
    textarea.style.padding = "10px";
    textarea.style.marginTop = "10px";
    textarea.style.border = "1px solid #ccc";
    textarea.style.borderRadius = "4px";
    textarea.style.fontFamily = "monospace";

    const modal = document.createElement("div");
    modal.style.position = "fixed";
    modal.style.top = "50%";
    modal.style.left = "50%";
    modal.style.transform = "translate(-50%, -50%)";
    modal.style.background = "#fff";
    modal.style.padding = "20px";
    modal.style.borderRadius = "10px";
    modal.style.boxShadow = "0 4px 20px rgba(0,0,0,0.2)";
    modal.style.zIndex = "10000";
    modal.style.width = "80%";
    modal.style.maxWidth = "600px";
    modal.style.maxHeight = "80vh";
    modal.style.overflow = "auto";

    const title = document.createElement("h3");
    title.textContent = "配置测试结果";
    title.style.margin = "0 0 15px 0";
    title.style.color = "#333";

    const closeButton = document.createElement("button");
    closeButton.textContent = "关闭";
    closeButton.style.padding = "8px 15px";
    closeButton.style.background = "#007BFF";
    closeButton.style.color = "#fff";
    closeButton.style.border = "none";
    closeButton.style.borderRadius = "4px";
    closeButton.style.marginTop = "15px";
    closeButton.style.cursor = "pointer";
    closeButton.addEventListener("click", () => {
      document.body.removeChild(modal);
    });

    const copyButton = document.createElement("button");
    copyButton.textContent = "复制配置";
    copyButton.style.padding = "8px 15px";
    copyButton.style.background = "#4CAF50";
    copyButton.style.color = "#fff";
    copyButton.style.border = "none";
    copyButton.style.borderRadius = "4px";
    copyButton.style.marginTop = "15px";
    copyButton.style.marginRight = "10px";
    copyButton.style.cursor = "pointer";
    copyButton.addEventListener("click", () => {
      textarea.select();
      document.execCommand("copy");
      copyButton.textContent = "已复制!";
      setTimeout(() => {
        copyButton.textContent = "复制配置";
      }, 2000);
    });

    const buttonContainer = document.createElement("div");
    buttonContainer.style.display = "flex";
    buttonContainer.style.justifyContent = "flex-start";

    buttonContainer.appendChild(copyButton);
    buttonContainer.appendChild(closeButton);

    modal.appendChild(title);
    modal.appendChild(textarea);
    modal.appendChild(buttonContainer);

    document.body.appendChild(modal);
    logger.groupEnd();
  }

  // 为按钮添加事件监听
  sortButton.addEventListener("click", () => {
    isReversed = !isReversed;
    sortButton.textContent = isReversed ? "倒序" : "正序";
    logger.debug(`排序切换为: ${isReversed ? "倒序" : "正序"}`);
    findAllQuestionsWithDeduplication();
  });

  infoButton.addEventListener("click", () => {
    const info = `
当前站点: ${hostname}
消息选择器: ${currentConfig.messageSelector}
文本选择器: ${currentConfig.textSelector || "无"}
找到问题数: ${questions.length}
        `;
    alert(info);
    logger.debug("显示信息弹窗");
  });

  // 添加配置测试按钮事件
  configTestButton.addEventListener("click", () => {
    logger.debug("点击配置测试按钮");
    testCurrentPageConfig();
  });

  // 点击切换悬浮窗显示状态
  button.addEventListener("click", () => {
    logger.debug("点击主按钮");
    if (
      floatWindow.style.display === "none" ||
      floatWindow.style.display === ""
    ) {
      findAllQuestionsWithDeduplication();
      if (questions.length === 0) {
        logger.warn("未找到任何问题");
        alert('未找到任何问题！请尝试点击"加载历史记录"按钮');
        floatWindow.style.display = "block";
        floatWindow.style.opacity = "1";
        button.textContent = "隐藏列表";
        return;
      }
      floatWindow.style.display = "block";
      floatWindow.style.opacity = "1";
      button.textContent = "隐藏列表";
      logger.debug("显示悬浮窗");
    } else {
      floatWindow.style.opacity = "0";
      setTimeout(() => {
        floatWindow.style.display = "none";
        button.textContent = "问题列表";
      }, 200);
      logger.debug("隐藏悬浮窗");
    }
  });

  // 加载历史记录的函数 - 优化版滚动策略
  function loadHistoryRecords() {
    if (isLoading) {
      logger.warn("已有一个加载任务正在执行，请等待完成");
      return;
    }

    logger.group("开始加载历史记录");

    isLoading = true;
    loadHistoryButton.textContent = "加载中...";
    loadHistoryButton.style.background = "#999";
    loadHistoryButton.style.cursor = "wait";

    // 保存当前滚动位置
    const scrollPosition = window.scrollY;
    logger.debug(`保存当前滚动位置: ${scrollPosition}px`);

    // 记录当前问题数量
    const initialQuestionCount = questions.length;
    logger.info(`当前已有问题数量: ${initialQuestionCount}`);
    logger.info(`当前网站: ${hostname}, 开始尝试加载历史记录`);

    // 智能加载历史记录
    async function smartLoadHistory(attempts) {
      logger.group(`执行智能加载, 第 ${attempts}/${2} 次尝试`);

      // 记录初始问题数
      const initialCount = questions.length;

      // 优先使用配置中指定的滚动容器
      let bestContainer = null;

      // 如果配置中有scrollContainerSelector，则优先使用
      if (currentConfig.scrollContainerSelector) {
        logger.info(
          `尝试使用配置的滚动容器选择器: ${currentConfig.scrollContainerSelector}`
        );
        try {
          const configuredContainers = document.querySelectorAll(
            currentConfig.scrollContainerSelector
          );
          if (configuredContainers.length > 0) {
            // 找出包含最多消息的容器
            let maxConfiguredMessages = 0;
            configuredContainers.forEach((container) => {
              const messageCount = container.querySelectorAll(
                currentConfig.messageSelector
              ).length;
              if (messageCount > maxConfiguredMessages) {
                maxConfiguredMessages = messageCount;
                bestContainer = container;
              }
            });

            if (bestContainer) {
              logger.success(
                `找到配置指定的滚动容器: ${bestContainer.tagName}.${bestContainer.className}`
              );
            }
          }
        } catch (e) {
          logger.warn(`使用配置的滚动容器选择器时出错: ${e.message}`);
        }
      }

      // 如果配置中没有指定滚动容器或者找不到，则自动查找
      if (!bestContainer) {
        logger.info("未使用配置滚动容器，尝试自动查找...");
        // 首先查找所有可滚动容器
        const scrollContainers = findAllScrollContainers();
        logger.info(`找到 ${scrollContainers.length} 个可滚动容器`);

        // 记录容器详细信息
        const containerDetails = scrollContainers.map((container, index) => {
          const messageCount = container.querySelectorAll(
            currentConfig.messageSelector
          ).length;
          return {
            index,
            tagName: container.tagName,
            className: container.className,
            width: container.clientWidth,
            height: container.clientHeight,
            scrollHeight: container.scrollHeight,
            messageCount,
          };
        });

        logger.debug("可滚动容器详情:");
        logger.table(containerDetails);

        // 找出包含最多消息的容器作为主要滚动容器
        let maxMessages = 0;

        for (const container of scrollContainers) {
          const messageCount = container.querySelectorAll(
            currentConfig.messageSelector
          ).length;

          if (messageCount > maxMessages) {
            maxMessages = messageCount;
            bestContainer = container;
          }
        }
      }

      // 执行滚动操作
      if (bestContainer) {
        logger.success(
          `使用滚动容器: ${bestContainer.tagName}.${bestContainer.className}`
        );
        logger.debug(
          `滚动前位置: ${bestContainer.scrollTop}px, 总高度: ${bestContainer.scrollHeight}px`
        );

        // 保存原始滚动位置
        const originalScrollTop = bestContainer.scrollTop;

        // 执行滚动到顶部
        const maxScrollAttempts = 3;
        for (let i = 0; i < maxScrollAttempts; i++) {
          logger.debug(`滚动尝试 ${i + 1}/${maxScrollAttempts}`);
          bestContainer.scrollTo({ top: 0, behavior: "auto" });

          // 确保滚动生效
          bestContainer.scrollTop = 0; // 直接设置，确保滚动生效
          await new Promise((resolve) => setTimeout(resolve, 500));

          // 如果已经到顶部，退出循环
          if (bestContainer.scrollTop < 10) {
            logger.success("已滚动到顶部或接近顶部");
            break;
          } else {
            logger.warn(`滚动后位置: ${bestContainer.scrollTop}px, 再次尝试`);
          }
        }

        // 等待内容加载
        logger.debug("等待内容加载 (2s)...");
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // 触发滚动事件以确保内容加载
        logger.debug("触发滚动事件以确保内容加载");
        bestContainer.dispatchEvent(new Event("scroll", { bubbles: true }));

        // 再次等待
        logger.debug("再次等待 (1s)...");
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // 如果是最后一次尝试，恢复滚动位置
        if (attempts >= 2) {
          logger.debug(`恢复原始滚动位置: ${originalScrollTop}px`);
          bestContainer.scrollTo({ top: originalScrollTop, behavior: "auto" });
        }
      } else {
        logger.warn("未找到合适的消息容器，尝试全局滚动");
        // 全局滚动到顶部
        window.scrollTo({ top: 0, behavior: "auto" });
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      // 更新问题列表
      logger.debug("重新查找问题...");
      findAllQuestionsWithDeduplication();

      // 检查是否找到了新问题
      const newCount = questions.length - initialCount;
      logger.info(`本次查找到 ${questions.length} 个问题，新增 ${newCount} 个`);

      logger.groupEnd();
      return questions.length > initialCount;
    }

    // 使用递归函数进行尝试加载
    const tryLoadHistory = async (attempts) => {
      logger.info(`尝试加载历史记录: 第${attempts}次尝试`);

      // 执行智能加载
      const success = await smartLoadHistory(attempts);

      // 如果成功加载了新问题，或者已经尝试了足够多次，则完成加载
      if (success || attempts >= 2) {
        const newQuestions = questions.length - initialQuestionCount;
        logger.success(
          `加载完成: 从${initialQuestionCount}条增加到${questions.length}条，新增${newQuestions}条`
        );

        // 重置按钮状态
        isLoading = false;
        loadHistoryButton.textContent = "加载历史记录";
        loadHistoryButton.style.background = "#4CAF50";
        loadHistoryButton.style.cursor = "pointer";

        // 显示加载结果消息
        if (newQuestions > 0) {
          alert(`成功加载了${newQuestions}条新的历史记录！`);
        } else {
          alert("没有找到新的历史记录，可能已经加载了全部历史或需要刷新页面。");
        }

        // 滚动回原来的位置
        logger.debug(`恢复页面滚动位置: ${scrollPosition}px`);
        window.scrollTo({ top: scrollPosition, behavior: "auto" });

        logger.groupEnd(); // 关闭主组
      } else if (attempts < 2) {
        // 短暂延迟后再次尝试
        logger.debug("短暂延迟后再次尝试...");
        setTimeout(() => {
          tryLoadHistory(attempts + 1);
        }, 2000);
      }
    };

    // 开始第一次尝试
    tryLoadHistory(1);
  }

  // 为加载历史记录按钮添加点击事件
  loadHistoryButton.addEventListener("click", loadHistoryRecords);

  // 监听用户输入新问题后触发查找
  function setupInputListener() {
    const input = document.querySelector(
      'textarea, input[type="text"], [contenteditable]'
    );
    if (input) {
      logger.debug(`找到输入元素: ${input.tagName}`);
      input.addEventListener("keypress", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          logger.debug("检测到按下Enter键，将在1秒后更新问题列表");
          setTimeout(findAllQuestionsWithDeduplication, 1000);
        }
      });
    } else {
      logger.warn("未找到输入元素");
    }

    // 监听可能的发送按钮点击
    const sendButtons = document.querySelectorAll(
      'button[type="submit"], button[aria-label*="send"], button[aria-label*="发送"]'
    );
    logger.debug(`找到 ${sendButtons.length} 个可能的发送按钮`);
    sendButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        logger.debug("检测到点击发送按钮，将在1秒后更新问题列表");
        setTimeout(findAllQuestionsWithDeduplication, 1000);
      });
    });
  }

  // 页面加载后初始化
  window.addEventListener("load", () => {
    logger.group("脚本初始化");
    logger.info("webAI聊天问题列表导航脚本测试版已加载");
    logger.info("当前网站:", hostname);
    logger.info("当前配置:", currentConfig);

    setTimeout(() => {
      findAllQuestionsWithDeduplication();
      logger.success(`初始问题列表加载完成，共找到${questions.length}个问题`);
      setupInputListener();

      // 添加键盘快捷键支持 - Alt+Q 显示/隐藏问题列表
      document.addEventListener("keydown", (e) => {
        if (e.altKey && e.key === "q") {
          logger.debug("检测到快捷键: Alt+Q");
          button.click();
        }
      });

      logger.debug("已设置键盘快捷键 Alt+Q 用于显示/隐藏问题列表");
      logger.groupEnd();
    }, 2000);
  });

  // MutationObserver 监听DOM变化，动态更新问题列表
  const observerConfig = { childList: true, subtree: true };
  const observer = new MutationObserver((mutationsList) => {
    // 只在悬浮窗显示时更新，避免不必要的性能消耗
    if (floatWindow.style.display === "block") {
      for (const mutation of mutationsList) {
        if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
          // 检查是否添加了新的消息元素
          const hasNewMessages = Array.from(mutation.addedNodes).some(
            (node) => {
              if (node.nodeType === Node.ELEMENT_NODE) {
                return (
                  (node.matches &&
                    node.matches(currentConfig.messageSelector)) ||
                  (node.querySelector &&
                    node.querySelector(currentConfig.messageSelector))
                );
              }
              return false;
            }
          );

          if (hasNewMessages) {
            // 使用节流技术避免频繁更新
            if (!observer.updateTimeout) {
              logger.debug("检测到DOM变化，稍后将更新问题列表");
              observer.updateTimeout = setTimeout(() => {
                findAllQuestionsWithDeduplication();
                observer.updateTimeout = null;
              }, 500);
            }
            break;
          }
        }
      }
    }
  });

  // 开始观察DOM变化
  setTimeout(() => {
    const chatContainer =
      document.querySelector(".chat-container, #chat, main, article") ||
      document.body;
    observer.observe(chatContainer, observerConfig);
    logger.debug("已启动DOM变化监听器");
  }, 3000);
})();
