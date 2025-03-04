// ==UserScript==
// @name         webAI聊天问题列表导航
// @namespace    http://tampermonkey.net/
// @version      2.10
// @description  通过点击按钮显示用户问题列表，支持导航到特定问题、分页功能、正序/倒序切换，优化性能并美化UI，适配CSP限制
// @author       yutao
// @match        https://grok.com/chat/*
// @match        https://github.com/copilot/*
// @match        https://yuanbao.tencent.com/chat/*
// @match        https://chat.qwenlm.ai/*
// @match        https://chat.qwen.ai/*
// @match        https://copilot.microsoft.com/chats/*
// @match        https://chatgpt.com/*
// @match        https://chat.deepseek.com/a/chat/*

// @grant        none
//@license

// ==/UserScript==

(function () {
    'use strict';

    // 配置对象，定义不同网站的聊天消息选择器和条件
    const config = {
        'grok.com': {
            messageSelector: 'div.message-bubble',
            textSelector: 'span.whitespace-pre-wrap',
            userCondition: (element) => element.classList.contains('bg-foreground') &&
                window.getComputedStyle(element).backgroundColor !== 'rgb(224, 247, 250)'
        },
        'github.com': {
            messageSelector: 'div.UserMessage-module__container--cAvvK.ChatMessage-module__userMessage--xvIFp',
            textSelector: null,
            userCondition: (element) => element.classList.contains('ChatMessage-module__userMessage--xvIFp')
        },
        'yuanbao.tencent.com': {
            messageSelector: 'div.agent-chat__bubble__content',
            textSelector: 'div.hyc-content-text',
            userCondition: (element) => true
        },
        'chat.qwenlm.ai': {
            messageSelector: 'div.rounded-3xl.bg-gray-50.dark\\:bg-gray-850',
            textSelector: 'p',
            userCondition: (element) => true
        },
        'chat.qwen.ai': {
            messageSelector: 'div.rounded-3xl.bg-gray-50.dark\\:bg-gray-850',
            textSelector: 'p',
            userCondition: (element) => true
        },
        'copilot.microsoft.com': {
            messageSelector: 'div.self-end.rounded-2xl',
            textSelector: null,
            userCondition: (element) => element.classList.contains('self-end')
        },
        'chatgpt.com': {
            messageSelector: 'div.rounded-3xl.bg-token-message-surface',
            textSelector: 'div.whitespace-pre-wrap',
            userCondition: (element) => true
        },
        'chat.deepseek.com': {
            messageSelector: 'div.fbb737a4',
            textSelector: null,
            userCondition: (element) => true
        }
    };

    // 获取当前域名并选择配置
    const hostname = window.location.hostname;
    const currentConfig = config[hostname] || {
        messageSelector: 'div[class*=message], div[class*=chat], div[class*=user]',
        textSelector: null,
        userCondition: (element) => true
    };

    // 创建美化后的浮动按钮
    const button = document.createElement('button');
    button.textContent = '问题列表';
    button.style.position = 'fixed';
    button.style.bottom = '20px';
    button.style.right = '20px';
    button.style.zIndex = '1000';
    button.style.padding = '10px 15px';
    button.style.background = 'linear-gradient(135deg, #007BFF, #00C4FF)';
    button.style.color = '#fff';
    button.style.border = 'none';
    button.style.borderRadius = '8px';
    button.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
    button.style.cursor = 'pointer';
    button.style.fontFamily = 'Arial, sans-serif';
    button.style.fontSize = '14px';
    button.style.transition = 'transform 0.2s, box-shadow 0.2s';
    button.addEventListener('mouseover', () => {
        button.style.transform = 'scale(1.05)';
        button.style.boxShadow = '0 4px 8px rgba(0,0,0,0.3)';
    });
    button.addEventListener('mouseout', () => {
        button.style.transform = 'scale(1)';
        button.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
    });
    document.body.appendChild(button);

    // 创建美化后的悬浮窗
    const floatWindow = document.createElement('div');
    floatWindow.style.position = 'fixed';
    floatWindow.style.bottom = '70px';
    floatWindow.style.right = '20px';
    floatWindow.style.width = '320px';
    floatWindow.style.maxHeight = '420px';
    floatWindow.style.background = '#ffffff';
    floatWindow.style.border = '1px solid #e0e0e0';
    floatWindow.style.borderRadius = '10px';
    floatWindow.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    floatWindow.style.padding = '15px';
    floatWindow.style.overflowY = 'auto';
    floatWindow.style.display = 'none';
    floatWindow.style.zIndex = '1000';
    floatWindow.style.fontFamily = 'Arial, sans-serif';
    floatWindow.style.transition = 'opacity 0.2s';
    document.body.appendChild(floatWindow);

    // 分页相关变量
    let questions = [];
    const pageSize = 10;
    let currentPage = 1;
    let isReversed = false;

    // 创建排序切换按钮
    const sortButton = document.createElement('button');
    sortButton.textContent = '正序';
    sortButton.style.marginBottom = '10px';
    sortButton.style.padding = '5px 10px';
    sortButton.style.background = '#007BFF';
    sortButton.style.color = '#fff';
    sortButton.style.border = 'none';
    sortButton.style.borderRadius = '4px';
    sortButton.style.cursor = 'pointer';
    sortButton.style.fontSize = '12px';
    sortButton.addEventListener('click', () => {
        isReversed = !isReversed;
        sortButton.textContent = isReversed ? '倒序' : '正序';
        findAllQuestions();
    });
    floatWindow.appendChild(sortButton);

    // 创建分页控件
    const paginationContainer = document.createElement('div');
    paginationContainer.style.display = 'flex';
    paginationContainer.style.justifyContent = 'center';
    paginationContainer.style.marginTop = '10px';
    paginationContainer.style.gap = '5px';

    // 问题列表容器
    const listContainer = document.createElement('ul');
    listContainer.style.listStyle = 'none';
    listContainer.style.padding = '0';
    listContainer.style.margin = '0';
    floatWindow.appendChild(listContainer);
    floatWindow.appendChild(paginationContainer);

    // 获取文本内容的辅助函数
    function getTextContent(element) {
        return element ? element.textContent.trim() : '';
    }

    // 查找所有用户问题的函数
    function findAllQuestions() {
        const chatContainer = document.querySelector('.chat-container, #chat, main, article') || document.body;
        const potentialMessages = chatContainer.querySelectorAll(currentConfig.messageSelector);
        questions = [];

        for (let i = 0; i < potentialMessages.length; i++) {
            const element = potentialMessages[i];
            const textElement = currentConfig.textSelector ? element.querySelector(currentConfig.textSelector) : element;
            const text = getTextContent(textElement);

            if (text && currentConfig.userCondition(element)) {
                questions.push({ element, text });
            }
        }

        if (isReversed) {
            questions.reverse();
        }

        renderPage(currentPage);
        updatePagination();
    }

    // 渲染指定页的问题（使用 DOM 操作替代 innerHTML）
    function renderPage(page) {
        // 清空列表容器
        while (listContainer.firstChild) {
            listContainer.removeChild(listContainer.firstChild);
        }

        const start = (page - 1) * pageSize;
        const end = page * pageSize;
        const pageQuestions = questions.slice(start, end);

        pageQuestions.forEach((q, idx) => {
            const listItem = document.createElement('li');
            const shortText = q.text.substring(0, 15) + (q.text.length > 15 ? '...' : '');
            listItem.textContent = `${isReversed ? questions.length - start - idx : start + idx + 1}: ${shortText}`;
            listItem.style.padding = '8px 12px';
            listItem.style.cursor = 'pointer';
            listItem.style.fontSize = '13px';
            listItem.style.color = '#333';
            listItem.style.whiteSpace = 'nowrap';
            listItem.style.overflow = 'hidden';
            listItem.style.textOverflow = 'ellipsis';
            listItem.style.borderBottom = '1px solid #f0f0f0';
            listItem.style.transition = 'background 0.2s';
            listItem.title = q.text;
            listItem.addEventListener('mouseover', () => {
                listItem.style.background = '#f5f5f5';
            });
            listItem.addEventListener('mouseout', () => {
                listItem.style.background = 'none';
            });
            listItem.addEventListener('click', () => {
                q.element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                floatWindow.style.opacity = '0';
                setTimeout(() => floatWindow.style.display = 'none', 200);
                console.log(`${questions.indexOf(q) + 1}: ${q.text.substring(0, 15)}...`);
            });
            listContainer.appendChild(listItem);
        });
    }

    // 更新分页控件
    function updatePagination() {
        // 清空分页容器
        while (paginationContainer.firstChild) {
            paginationContainer.removeChild(paginationContainer.firstChild);
        }

        const totalPages = Math.ceil(questions.length / pageSize);
        if (totalPages) {
            const prevButton = document.createElement('button');
            prevButton.textContent = '上一页';
            prevButton.style.padding = '5px 10px';
            prevButton.style.border = 'none';
            prevButton.style.background = currentPage === 1 ? '#f0f0f0' : '#007BFF';
            prevButton.style.color = currentPage === 1 ? '#aaa' : '#fff';
            prevButton.style.cursor = currentPage === 1 ? 'not-allowed' : 'pointer';
            prevButton.style.borderRadius = '4px';
            prevButton.disabled = currentPage === 1;
            prevButton.addEventListener('click', () => {
                if (currentPage > 1) {
                    currentPage--;
                    renderPage(currentPage);
                    updatePagination();
                }
            });
            paginationContainer.appendChild(prevButton);

            for (let i = 1; i <= totalPages; i++) {
                const pageButton = document.createElement('button');
                pageButton.textContent = i;
                pageButton.style.padding = '5px 10px';
                pageButton.style.border = 'none';
                pageButton.style.background = currentPage === i ? '#007BFF' : '#f0f0f0';
                pageButton.style.color = currentPage === i ? '#fff' : '#333';
                pageButton.style.cursor = 'pointer';
                pageButton.style.borderRadius = '4px';
                pageButton.addEventListener('click', () => {
                    currentPage = i;
                    renderPage(currentPage);
                    updatePagination();
                });
                paginationContainer.appendChild(pageButton);
            }

            const nextButton = document.createElement('button');
            nextButton.textContent = '下一页';
            nextButton.style.padding = '5px 10px';
            nextButton.style.border = 'none';
            nextButton.style.background = currentPage === totalPages ? '#f0f0f0' : '#007BFF';
            nextButton.style.color = currentPage === totalPages ? '#aaa' : '#fff';
            nextButton.style.cursor = currentPage === totalPages ? 'not-allowed' : 'pointer';
            nextButton.style.borderRadius = '4px';
            nextButton.disabled = currentPage === totalPages;
            nextButton.addEventListener('click', () => {
                if (currentPage < totalPages) {
                    currentPage++;
                    renderPage(currentPage);
                    updatePagination();
                }
            });
            paginationContainer.appendChild(nextButton);
        }
    }

    // 点击切换悬浮窗显示状态
    button.addEventListener('click', () => {
        if (floatWindow.style.display === 'none' || floatWindow.style.display === '') {
            findAllQuestions();
            if (questions.length === 0) {
                alert('未找到任何问题！');
                return;
            }
            floatWindow.style.display = 'block';
            floatWindow.style.opacity = '1';
            button.textContent = '隐藏列表';
        } else {
            floatWindow.style.opacity = '0';
            setTimeout(() => {
                floatWindow.style.display = 'none';
                button.textContent = '问题列表';
            }, 200);
        }
    });

    // 监听用户输入新问题后触发查找
    function setupInputListener() {
        const input = document.querySelector('textarea, input[type="text"], [contenteditable]');
        if (input) {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    setTimeout(findAllQuestions, 1000);
                }
            });
        }
    }

    // 页面加载后初始化
    window.addEventListener('load', () => {
        setTimeout(() => {
            findAllQuestions();
            setupInputListener();
        }, 2000);
    });
})();
