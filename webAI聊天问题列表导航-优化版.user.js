// ==UserScript==
// @name         webAI聊天问题列表导航
// @namespace    http://tampermonkey.net/
// @version      3.0.0
// @description  通过点击按钮显示用户问题列表，支持导航到特定问题、分页功能、正序/倒序切换，自动加载历史记录
// @author       yutao
// @match        https://grok.com/chat/*
// @match        https://github.com/copilot/*
// @match        https://yuanbao.tencent.com/chat/*
// @match        https://chat.qwenlm.ai/c/*
// @match        https://chat.qwen.ai/c/*
// @match        https://copilot.microsoft.com/chats/*
// @match        https://chatgpt.com/c/*
// @match        https://chat.deepseek.com/a/chat/*
// @grant        none
// MIT License
// 
// Copyright (c) [2025] [yutao]
// 
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
// 
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
// 
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.@license
// ==/UserScript==

(function () {
    'use strict';

    // 配置对象，定义不同网站的聊天消息选择器和条件
    const config = {
        'grok.com': {
            messageSelector: 'div.message-bubble',
            textSelector: 'span.whitespace-pre-wrap',
            userCondition: (element) => element.classList.contains('bg-foreground') &&
                window.getComputedStyle(element).backgroundColor !== 'rgb(224, 247, 250)',
            scrollContainerSelector: 'main > div > div:nth-child(1)'
        },
        'github.com': {
            messageSelector: 'div.UserMessage-module__container--cAvvK.ChatMessage-module__userMessage--xvIFp',
            textSelector: null,
            userCondition: (element) => element.classList.contains('ChatMessage-module__userMessage--xvIFp'),
            scrollContainerSelector: '.react-scroll-to-bottom--css-xgtui-79elbk'
        },
        'yuanbao.tencent.com': {
            messageSelector: 'div.agent-chat__bubble__content',
            textSelector: 'div.hyc-content-text',
            userCondition: (element) => true,
            scrollContainerSelector: '.agent-chat__bubble-wrap'
        },
        'chat.qwenlm.ai': {
            messageSelector: 'div.rounded-3xl.bg-gray-50.dark\\:bg-gray-850',
            textSelector: 'p',
            userCondition: (element) => true,
            scrollContainerSelector: 'main div.flex-col.overflow-auto'
        },
        'chat.qwen.ai': {
            messageSelector: 'div.dark\\:bg-gray-850, div[class*="message-item"], div[class*="user-message"], div.bg-blue-100',
            textSelector: 'div[class*="markdown-content"], p, div[class*="text"], span[class*="content"]',
            userCondition: (element) => {
                return element.classList.contains('bg-blue-100') || 
                       (element.querySelector('[class*="user-message"]') !== null) ||
                       (element.getAttribute('data-message-author-role') === 'user');
            },
            scrollContainerSelector: '#messages-container, div[class*="overflow-auto"][class*="flex-col"]'
        },
        'copilot.microsoft.com': {
            messageSelector: 'div.self-end.rounded-2xl',
            textSelector: null,
            userCondition: (element) => element.classList.contains('self-end'),
            scrollContainerSelector: '.overflow-y-auto.flex-1'
        },
        'chatgpt.com': {
            messageSelector: 'div.rounded-3xl.bg-token-message-surface',
            textSelector: 'div.whitespace-pre-wrap',
            userCondition: (element) => true,
            scrollContainerSelector: 'main div.overflow-y-auto'
        },
        'chat.deepseek.com': {
            messageSelector: 'div.fbb737a4',
            textSelector: null,
            userCondition: (element) => true,
            scrollContainerSelector: '.scroll-container'
        }
    };

    // 获取当前域名并选择配置
    const hostname = window.location.hostname;
    const currentConfig = config[hostname] || {
        messageSelector: 'div[class*=message], div[class*=chat], div[class*=user]',
        textSelector: null,
        userCondition: (element) => true,
        scrollContainerSelector: 'main, .chat-container, #chat'
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
    let isLoading = false; // 加载状态标志
    let autoLoadCompleted = false; // 标记自动加载是否已完成

    // 创建顶部按钮容器
    const topButtonContainer = document.createElement('div');
    topButtonContainer.style.display = 'flex';
    topButtonContainer.style.justifyContent = 'space-between';
    topButtonContainer.style.marginBottom = '15px';
    
    // 创建排序切换按钮
    const sortButton = document.createElement('button');
    sortButton.textContent = '正序';
    sortButton.style.padding = '5px 10px';
    sortButton.style.background = '#007BFF';
    sortButton.style.color = '#fff';
    sortButton.style.border = 'none';
    sortButton.style.borderRadius = '4px';
    sortButton.style.cursor = 'pointer';
    sortButton.style.fontSize = '12px';
    sortButton.style.transition = 'background 0.2s';
    sortButton.addEventListener('mouseover', () => {
        sortButton.style.background = '#0069d9';
    });
    sortButton.addEventListener('mouseout', () => {
        sortButton.style.background = '#007BFF';
    });
    sortButton.addEventListener('click', () => {
        isReversed = !isReversed;
        sortButton.textContent = isReversed ? '倒序' : '正序';
        findAllQuestionsWithDeduplication();
    });

    // 状态显示标签
    const statusLabel = document.createElement('div');
    statusLabel.textContent = '正在加载历史...';
    statusLabel.style.fontSize = '12px';
    statusLabel.style.color = '#666';
    statusLabel.style.padding = '5px 0';
    statusLabel.style.display = 'none'; // 默认隐藏

    // 将按钮添加到容器中
    topButtonContainer.appendChild(statusLabel);
    topButtonContainer.appendChild(sortButton);
    floatWindow.appendChild(topButtonContainer);

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

    // 创建问题计数显示区域
    const questionCountDisplay = document.createElement('div');
    questionCountDisplay.style.fontSize = '12px';
    questionCountDisplay.style.color = '#666';
    questionCountDisplay.style.textAlign = 'center';
    questionCountDisplay.style.margin = '5px 0 10px 0';
    floatWindow.insertBefore(questionCountDisplay, listContainer);

    // 更新问题计数显示
    function updateQuestionCountDisplay() {
        questionCountDisplay.textContent = `共找到 ${questions.length} 个问题`;
    }

    // 获取文本内容的辅助函数
    function getTextContent(element) {
        return element ? element.textContent.trim() : '';
    }

    // 查找所有用户问题并去重的函数
    function findAllQuestionsWithDeduplication() {
        const chatContainer = document.querySelector('.chat-container, #chat, main, article') || document.body;
        const potentialMessages = chatContainer.querySelectorAll(currentConfig.messageSelector);
        
        // 临时存储所有找到的问题
        const foundQuestions = [];
        const seenTexts = new Set(); // 用于去重
        
        for (let i = 0; i < potentialMessages.length; i++) {
            const element = potentialMessages[i];
            const textElement = currentConfig.textSelector ? element.querySelector(currentConfig.textSelector) : element;
            const text = getTextContent(textElement);
            
            // 如果文本内容有效且符合用户消息条件
            if (text && text.length > 2 && currentConfig.userCondition(element)) {
                // 使用文本内容进行去重
                if (!seenTexts.has(text)) {
                    seenTexts.add(text);
                    foundQuestions.push({ element, text });
                }
            }
        }
        
        // 更新全局问题列表
        questions = foundQuestions;
        
        // 确保排序正确
        if (isReversed) {
            questions.reverse();
        }
        
        // 更新界面
        updateQuestionCountDisplay();
        renderPage(currentPage);
        updatePagination();
    }

    // 加载历史记录的函数 - 直接使用配置的滚动容器
    async function loadHistoryRecords() {
        if (isLoading) return;
        
        isLoading = true;
        statusLabel.textContent = '正在加载历史...';
        statusLabel.style.display = 'block';
        
        // 保存当前滚动位置
        const scrollPosition = window.scrollY;
        
        // 记录当前问题数量
        const initialQuestionCount = questions.length;
        
        // 使用配置的滚动容器加载历史记录
        async function smartLoadHistory(attempts) {
            // 直接使用配置中指定的滚动容器
            const scrollContainer = document.querySelector(currentConfig.scrollContainerSelector);
            
            // 执行滚动操作
            if (scrollContainer) {
                // 保存原始滚动位置
                const originalScrollTop = scrollContainer.scrollTop;
                
                // 执行滚动到顶部
                const maxScrollAttempts = 3;
                for (let i = 0; i < maxScrollAttempts; i++) {
                    scrollContainer.scrollTo({top: 0, behavior: 'auto'});
                    
                    // 确保滚动生效
                    scrollContainer.scrollTop = 0; // 直接设置，确保滚动生效
                    await new Promise(resolve => setTimeout(resolve, 500));
                    
                    // 如果已经到顶部，退出循环
                    if (scrollContainer.scrollTop < 10) {
                        break;
                    }
                }
                
                // 等待内容加载
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                // 触发滚动事件以确保内容加载
                scrollContainer.dispatchEvent(new Event('scroll', {bubbles: true}));
                
                // 再次等待
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // 如果是最后一次尝试，恢复滚动位置
                if (attempts >= 3) {
                    scrollContainer.scrollTo({top: originalScrollTop, behavior: 'auto'});
                }
            } else {
                // 如果未找到配置的滚动容器，使用全局滚动
                window.scrollTo({top: 0, behavior: 'auto'});
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
            
            // 更新问题列表
            findAllQuestionsWithDeduplication();
            
            // 检查是否找到了新问题
            return questions.length > initialQuestionCount;
        }
        
        // 使用递归函数进行尝试加载
        const tryLoadHistory = async (attempts) => {
            // 执行智能加载
            const success = await smartLoadHistory(attempts);
            
            // 如果成功加载了新问题，或者已经尝试了足够多次，则完成加载
            if (success || attempts >= 3) {
                const newQuestions = questions.length - initialQuestionCount;
                
                // 更新状态
                isLoading = false;
                autoLoadCompleted = true;
                
                // 更新状态标签
                statusLabel.textContent = newQuestions > 0 
                    ? `已加载${newQuestions}条历史记录` 
                    : '未找到更多历史记录';
                
                // 延迟隐藏状态标签
                setTimeout(() => {
                    statusLabel.style.display = 'none';
                }, 3000);
                
                // 滚动回原来的位置
                window.scrollTo({top: scrollPosition, behavior: 'auto'});
            } else if (attempts < 3) {
                // 短暂延迟后再次尝试
                setTimeout(() => {
                    tryLoadHistory(attempts + 1);
                }, 2000);
            }
        };
        
        // 开始第一次尝试
        await tryLoadHistory(1);
    }

    // 使找到的问题定位在屏幕中
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
            const shortText = q.text.substring(0, 20) + (q.text.length > 20 ? '...' : '');
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
            listItem.style.borderRadius = '4px';
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
                button.textContent = '问题列表';
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
            prevButton.style.transition = 'background 0.2s';
            prevButton.disabled = currentPage === 1;
            prevButton.addEventListener('click', () => {
                if (currentPage > 1) {
                    currentPage--;
                    renderPage(currentPage);
                    updatePagination();
                }
            });
            paginationContainer.appendChild(prevButton);

            // 显示页码按钮，但限制最多显示5个
            const maxButtons = 5;
            let startPage = Math.max(1, Math.min(currentPage - Math.floor(maxButtons / 2), totalPages - maxButtons + 1));
            if (startPage < 1) startPage = 1;
            const endPage = Math.min(startPage + maxButtons - 1, totalPages);

            if (startPage > 1) {
                const firstPageButton = document.createElement('button');
                firstPageButton.textContent = '1';
                firstPageButton.style.padding = '5px 10px';
                firstPageButton.style.border = 'none';
                firstPageButton.style.background = '#f0f0f0';
                firstPageButton.style.color = '#333';
                firstPageButton.style.cursor = 'pointer';
                firstPageButton.style.borderRadius = '4px';
                firstPageButton.style.transition = 'background 0.2s';
                firstPageButton.addEventListener('click', () => {
                    currentPage = 1;
                    renderPage(currentPage);
                    updatePagination();
                });
                paginationContainer.appendChild(firstPageButton);

                if (startPage > 2) {
                    const ellipsis = document.createElement('span');
                    ellipsis.textContent = '...';
                    ellipsis.style.padding = '5px';
                    ellipsis.style.color = '#666';
                    paginationContainer.appendChild(ellipsis);
                }
            }

            for (let i = startPage; i <= endPage; i++) {
                const pageButton = document.createElement('button');
                pageButton.textContent = i;
                pageButton.style.padding = '5px 10px';
                pageButton.style.border = 'none';
                pageButton.style.background = currentPage === i ? '#007BFF' : '#f0f0f0';
                pageButton.style.color = currentPage === i ? '#fff' : '#333';
                pageButton.style.cursor = 'pointer';
                pageButton.style.borderRadius = '4px';
                pageButton.style.transition = 'background 0.2s';
                pageButton.addEventListener('click', () => {
                    currentPage = i;
                    renderPage(currentPage);
                    updatePagination();
                });
                paginationContainer.appendChild(pageButton);
            }

            if (endPage < totalPages) {
                if (endPage < totalPages - 1) {
                    const ellipsis = document.createElement('span');
                    ellipsis.textContent = '...';
                    ellipsis.style.padding = '5px';
                    ellipsis.style.color = '#666';
                    paginationContainer.appendChild(ellipsis);
                }

                const lastPageButton = document.createElement('button');
                lastPageButton.textContent = totalPages;
                lastPageButton.style.padding = '5px 10px';
                lastPageButton.style.border = 'none';
                lastPageButton.style.background = '#f0f0f0';
                lastPageButton.style.color = '#333';
                lastPageButton.style.cursor = 'pointer';
                lastPageButton.style.borderRadius = '4px';
                lastPageButton.style.transition = 'background 0.2s';
                lastPageButton.addEventListener('click', () => {
                    currentPage = totalPages;
                    renderPage(currentPage);
                    updatePagination();
                });
                paginationContainer.appendChild(lastPageButton);
            }

            const nextButton = document.createElement('button');
            nextButton.textContent = '下一页';
            nextButton.style.padding = '5px 10px';
            nextButton.style.border = 'none';
            nextButton.style.background = currentPage === totalPages ? '#f0f0f0' : '#007BFF';
            nextButton.style.color = currentPage === totalPages ? '#aaa' : '#fff';
            nextButton.style.cursor = currentPage === totalPages ? 'not-allowed' : 'pointer';
            nextButton.style.borderRadius = '4px';
            nextButton.style.transition = 'background 0.2s';
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
            findAllQuestionsWithDeduplication();
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
                if (e.key === 'Enter' && !e.shiftKey) {
                    setTimeout(findAllQuestionsWithDeduplication, 1000);
                }
            });
        }
        
        // 监听可能的发送按钮点击
        const sendButtons = document.querySelectorAll('button[type="submit"], button[aria-label*="send"], button[aria-label*="发送"]');
        sendButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                setTimeout(findAllQuestionsWithDeduplication, 1000);
            });
        });
    }

    // 页面加载后初始化
    window.addEventListener('load', () => {
        // 先找一次所有问题
        setTimeout(() => {
            findAllQuestionsWithDeduplication();
            setupInputListener();
            
            // 添加键盘快捷键支持 - Alt+Q 显示/隐藏问题列表
            document.addEventListener('keydown', (e) => {
                if (e.altKey && e.key === 'q') {
                    button.click();
                }
            });
            
            // 自动加载历史记录（延迟执行，让页面先完成初始化）
            setTimeout(() => {
                loadHistoryRecords();
            }, 2000);
        }, 1000);
    });
    
    // MutationObserver 监听DOM变化，动态更新问题列表
    const observerConfig = { childList: true, subtree: true };
    const observer = new MutationObserver((mutationsList) => {
        // 检查是否需要更新问题列表
        for (const mutation of mutationsList) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                // 检查是否添加了新的消息元素
                const hasNewMessages = Array.from(mutation.addedNodes).some(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        return node.matches && node.matches(currentConfig.messageSelector) || 
                               node.querySelector && node.querySelector(currentConfig.messageSelector);
                    }
                    return false;
                });
                
                if (hasNewMessages) {
                    // 使用节流技术避免频繁更新
                    if (!observer.updateTimeout) {
                        observer.updateTimeout = setTimeout(() => {
                            findAllQuestionsWithDeduplication();
                            observer.updateTimeout = null;
                        }, 500);
                    }
                    break;
                }
            }
        }
    });
    
    // 开始观察DOM变化
    setTimeout(() => {
        const chatContainer = document.querySelector('.chat-container, #chat, main, article') || document.body;
        observer.observe(chatContainer, observerConfig);
    }, 1500);
})(); 