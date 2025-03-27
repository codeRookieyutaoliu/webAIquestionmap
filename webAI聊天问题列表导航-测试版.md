# webAI聊天问题列表导航-测试版 修改指南

以下是创建测试版脚本需要进行的关键修改：

## 1. 修改脚本基本信息
```javascript
// ==UserScript==
// @name         webAI聊天问题列表导航-测试版
// @namespace    http://tampermonkey.net/
// @version      3.1-test
// @description  测试版：通过点击按钮显示用户问题列表，支持导航、分页、排序，详细日志和配置测试功能
// @author       yutao
// 保留原有的match规则
// @grant        none
// ==/UserScript==
```

## 2. 添加测试配置按钮
在创建顶部按钮容器之后，添加：
```javascript
// 创建配置测试按钮
const configTestButton = document.createElement('button');
configTestButton.textContent = '配置测试';
configTestButton.style.marginBottom = '10px';
configTestButton.style.marginRight = '10px';
configTestButton.style.padding = '5px 10px';
configTestButton.style.background = '#FF5722';
configTestButton.style.color = '#fff';
configTestButton.style.border = 'none';
configTestButton.style.borderRadius = '4px';
configTestButton.style.cursor = 'pointer';
configTestButton.style.fontSize = '12px';
configTestButton.style.transition = 'background 0.2s';
configTestButton.addEventListener('mouseover', () => {
    configTestButton.style.background = '#E64A19';
});
configTestButton.addEventListener('mouseout', () => {
    configTestButton.style.background = '#FF5722';
});

// 将配置测试按钮添加到顶部按钮容器
topButtonContainer.appendChild(configTestButton);
```

## 3. 添加配置测试功能
```javascript
// 添加配置测试功能
configTestButton.addEventListener('click', () => {
    testCurrentPageConfig();
});

// 配置测试功能
function testCurrentPageConfig() {
    console.group('🛠️ 配置测试开始');
    console.log('当前页面URL:', window.location.href);
    console.log('当前域名:', hostname);
    
    // 记录页面元素信息
    const allElements = document.querySelectorAll('*');
    console.log(`页面总元素数: ${allElements.length}`);
    
    // 测试不同选择器
    const testSelectors = [
        'div[class*=message]',
        'div[class*=chat]',
        'div[class*=user]',
        'div.message',
        '.message',
        '.chat-message',
        '.user-message',
        'div[role="listitem"]',
        'article',
        'div.bubble',
        'div.content'
    ];
    
    const selectorResults = {};
    
    testSelectors.forEach(selector => {
        try {
            const elements = document.querySelectorAll(selector);
            selectorResults[selector] = elements.length;
        } catch (e) {
            selectorResults[selector] = `错误: ${e.message}`;
        }
    });
    
    console.table(selectorResults);
    
    // 测试当前配置
    console.log('当前配置:', currentConfig);
    const currentElements = document.querySelectorAll(currentConfig.messageSelector);
    console.log(`当前选择器匹配到 ${currentElements.length} 个元素`);
    
    // 分析匹配到的元素
    const elementAnalysis = [];
    currentElements.forEach((el, index) => {
        if (index < 10) { // 只分析前10个元素以避免日志过长
            const textEl = currentConfig.textSelector ? el.querySelector(currentConfig.textSelector) : el;
            const text = getTextContent(textEl);
            const isUserMsg = currentConfig.userCondition(el);
            const classes = Array.from(el.classList).join(', ');
            elementAnalysis.push({
                index,
                isUserMsg,
                text: text.substring(0, 30) + (text.length > 30 ? '...' : ''),
                classes,
                tagName: el.tagName
            });
        }
    });
    
    console.table(elementAnalysis);
    
    // 生成该网站的最佳配置建议
    const userMsgCount = currentElements.length > 0 ? 
        Array.from(currentElements).filter(el => currentConfig.userCondition(el)).length : 0;
    
    // 寻找可能的文本选择器
    const possibleTextSelectors = ['p', 'div', 'span', 'pre', 'code']
        .map(tag => `${tag}[class*=text], ${tag}[class*=content], ${tag}.text, ${tag}.content, ${tag}`)
        .concat(['[class*=text]', '[class*=content]', '.text', '.content']);
    
    const textSelectorResults = {};
    if (currentElements.length > 0) {
        const sampleElement = currentElements[0];
        possibleTextSelectors.forEach(selector => {
            try {
                const found = sampleElement.querySelectorAll(selector);
                textSelectorResults[selector] = found.length;
            } catch (e) {
                textSelectorResults[selector] = `错误: ${e.message}`;
            }
        });
    }
    
    console.log('可能的文本选择器:');
    console.table(textSelectorResults);
    
    // 生成建议配置
    let bestMessageSelector = currentConfig.messageSelector;
    let bestTextSelector = currentConfig.textSelector;
    
    // 根据测试结果找出匹配数最多的选择器
    let maxMatches = 0;
    for (const [selector, count] of Object.entries(selectorResults)) {
        if (typeof count === 'number' && count > maxMatches && count < 1000) { // 避免选择太通用的选择器
            maxMatches = count;
            bestMessageSelector = selector;
        }
    }
    
    // 尝试生成一个更好的文本选择器
    let bestTextSelectorMatches = 0;
    for (const [selector, count] of Object.entries(textSelectorResults)) {
        if (typeof count === 'number' && count > 0 && count < 20) { // 避免太多匹配
            bestTextSelectorMatches = count;
            bestTextSelector = selector;
        }
    }
    
    // 寻找最佳滚动容器选择器
    logger.info('分析最佳滚动容器...');
    const scrollContainers = findAllScrollContainers();
    const messageCount = {};
    let bestScrollContainer = null;
    let bestScrollSelector = '';
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
                const significantClasses = classNames.filter(cls => 
                    cls.includes('scroll') || 
                    cls.includes('container') || 
                    cls.includes('chat') || 
                    cls.includes('message') ||
                    cls.includes('overflow') ||
                    cls.includes('content')
                );
                
                if (significantClasses.length > 0) {
                    bestScrollSelector = `${bestScrollContainer.tagName.toLowerCase()}[class*="${significantClasses[0]}"]`;
                    
                    // 如果有多个特征类，加上第二个特征
                    if (significantClasses.length > 1) {
                        bestScrollSelector += `[class*="${significantClasses[1]}"]`;
                    }
                } else {
                    // 如果没有特征类，使用第一个类
                    bestScrollSelector = `${bestScrollContainer.tagName.toLowerCase()}.${classNames[0]}`;
                }
            } else {
                // 没有ID和类，使用默认选择器
                bestScrollSelector = '#messages-container, div[class*="overflow-auto"][class*="flex-col"]';
            }
        }
    } else {
        // 没有找到合适的滚动容器，使用默认选择器
        bestScrollSelector = '#messages-container, div[class*="overflow-auto"][class*="flex-col"]';
    }
    
    logger.info(`建议的滚动容器选择器: ${bestScrollSelector}`);
    
    const suggestedConfig = {
        messageSelector: bestMessageSelector,
        textSelector: bestTextSelector,
        userCondition: 'function(element) { return true; }', // 简化起见
        scrollContainerSelector: bestScrollSelector
    };
    
    logger.success('建议配置对象:', suggestedConfig);
    
    // 显示配置代码
    const configCode = `'${hostname}': {
    messageSelector: '${bestMessageSelector}',
    textSelector: ${bestTextSelector ? `'${bestTextSelector}'` : 'null'},
    userCondition: (element) => true,
    scrollContainerSelector: '${bestScrollSelector}'
},`;
    
    logger.info('配置代码:');
    logger.info(configCode);
    
    // 创建一个可复制的配置信息弹窗
    const configInfo = `
网站域名: ${hostname}
页面地址: ${window.location.href}
匹配元素: ${currentElements.length}个 (其中用户消息: ${userMsgCount}个)

// 推荐配置代码:
'${hostname}': {
    messageSelector: '${bestMessageSelector}',
    textSelector: ${bestTextSelector ? `'${bestTextSelector}'` : 'null'},
    userCondition: (element) => true,
    scrollContainerSelector: '${bestScrollSelector}'
},

// 测试的选择器结果:
${JSON.stringify(selectorResults, null, 2)}

// 当前配置:
${JSON.stringify(currentConfig, null, 2)}
`;
    
    const textarea = document.createElement('textarea');
    textarea.value = configInfo;
    textarea.style.width = '100%';
    textarea.style.height = '300px';
    textarea.style.padding = '10px';
    textarea.style.marginTop = '10px';
    textarea.style.border = '1px solid #ccc';
    textarea.style.borderRadius = '4px';
    textarea.style.fontFamily = 'monospace';
    
    const modal = document.createElement('div');
    modal.style.position = 'fixed';
    modal.style.top = '50%';
    modal.style.left = '50%';
    modal.style.transform = 'translate(-50%, -50%)';
    modal.style.background = '#fff';
    modal.style.padding = '20px';
    modal.style.borderRadius = '10px';
    modal.style.boxShadow = '0 4px 20px rgba(0,0,0,0.2)';
    modal.style.zIndex = '10000';
    modal.style.width = '80%';
    modal.style.maxWidth = '600px';
    modal.style.maxHeight = '80vh';
    modal.style.overflow = 'auto';
    
    const title = document.createElement('h3');
    title.textContent = '配置测试结果';
    title.style.margin = '0 0 15px 0';
    title.style.color = '#333';
    
    const closeButton = document.createElement('button');
    closeButton.textContent = '关闭';
    closeButton.style.padding = '8px 15px';
    closeButton.style.background = '#007BFF';
    closeButton.style.color = '#fff';
    closeButton.style.border = 'none';
    closeButton.style.borderRadius = '4px';
    closeButton.style.marginTop = '15px';
    closeButton.style.cursor = 'pointer';
    closeButton.addEventListener('click', () => {
        document.body.removeChild(modal);
    });
    
    const copyButton = document.createElement('button');
    copyButton.textContent = '复制配置';
    copyButton.style.padding = '8px 15px';
    copyButton.style.background = '#4CAF50';
    copyButton.style.color = '#fff';
    copyButton.style.border = 'none';
    copyButton.style.borderRadius = '4px';
    copyButton.style.marginTop = '15px';
    copyButton.style.marginRight = '10px';
    copyButton.style.cursor = 'pointer';
    copyButton.addEventListener('click', () => {
        textarea.select();
        document.execCommand('copy');
        copyButton.textContent = '已复制!';
        setTimeout(() => {
            copyButton.textContent = '复制配置';
        }, 2000);
    });
    
    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.justifyContent = 'flex-start';
    
    buttonContainer.appendChild(copyButton);
    buttonContainer.appendChild(closeButton);
    
    modal.appendChild(title);
    modal.appendChild(textarea);
    modal.appendChild(buttonContainer);
    
    document.body.appendChild(modal);
    console.groupEnd();
}
```

## 4. 增强日志功能
修改原有的日志部分，加入更详细的日志记录：

```javascript
// 创建日志工具
const logger = {
    debug: function(message, ...args) {
        console.log(`%c[DEBUG] ${message}`, 'color: #9E9E9E', ...args);
    },
    info: function(message, ...args) {
        console.log(`%c[INFO] ${message}`, 'color: #2196F3', ...args);
    },
    success: function(message, ...args) {
        console.log(`%c[SUCCESS] ${message}`, 'color: #4CAF50', ...args);
    },
    warn: function(message, ...args) {
        console.log(`%c[WARN] ${message}`, 'color: #FF9800', ...args);
    },
    error: function(message, ...args) {
        console.log(`%c[ERROR] ${message}`, 'color: #F44336', ...args);
    },
    group: function(name) {
        console.group(`%c[GROUP] ${name}`, 'color: #673AB7; font-weight: bold');
    },
    groupEnd: function() {
        console.groupEnd();
    },
    table: function(data) {
        console.table(data);
    }
};
```

## 5. 修改查找问题函数
修改 `findAllQuestionsWithDeduplication` 函数以增加更详细的日志：

```javascript
// 查找所有用户问题并去重的函数
function findAllQuestionsWithDeduplication() {
    logger.group('查找用户问题');
    
    const chatContainer = document.querySelector('.chat-container, #chat, main, article') || document.body;
    logger.info('使用聊天容器:', chatContainer);
    
    const potentialMessages = chatContainer.querySelectorAll(currentConfig.messageSelector);
    logger.info(`使用选择器 "${currentConfig.messageSelector}" 找到 ${potentialMessages.length} 个潜在消息元素`);
    
    // 临时存储所有找到的问题
    const foundQuestions = [];
    const seenTexts = new Set(); // 用于去重
    
    // 详细记录每个元素的处理情况
    const processedElements = [];
    
    for (let i = 0; i < potentialMessages.length; i++) {
        const element = potentialMessages[i];
        const textElement = currentConfig.textSelector ? element.querySelector(currentConfig.textSelector) : element;
        const text = getTextContent(textElement);
        
        // 记录元素处理信息
        const elementInfo = {
            index: i,
            hasText: !!text,
            textLength: text ? text.length : 0,
            isUserMessage: currentConfig.userCondition(element),
            text: text ? (text.length > 30 ? text.substring(0, 30) + '...' : text) : '',
            selected: false,
            reason: ''
        };
        
        // 如果文本内容有效且符合用户消息条件
        if (text && text.length > 2 && currentConfig.userCondition(element)) {
            // 使用文本内容进行去重
            if (!seenTexts.has(text)) {
                seenTexts.add(text);
                foundQuestions.push({ element, text });
                elementInfo.selected = true;
                elementInfo.reason = '有效用户消息';
            } else {
                elementInfo.reason = '重复消息，已跳过';
            }
        } else {
            if (!text) {
                elementInfo.reason = '无文本内容';
            } else if (text.length <= 2) {
                elementInfo.reason = '文本内容太短';
            } else if (!currentConfig.userCondition(element)) {
                elementInfo.reason = '不符合用户消息条件';
            }
        }
        
        processedElements.push(elementInfo);
    }
    
    // 输出元素处理详情
    logger.debug('元素处理详情:');
    logger.table(processedElements);
    
    // 更新全局问题列表
    questions = foundQuestions;
    logger.success(`找到 ${questions.length} 个去重后的问题`);
    
    // 确保排序正确
    if (isReversed) {
        questions.reverse();
        logger.debug('已应用倒序排序');
    }
    
    // 更新界面
    updateQuestionCountDisplay();
    renderPage(currentPage);
    updatePagination();
    
    logger.groupEnd();
}
```

## 6. 增强加载历史记录功能

```javascript
// 加载历史记录的函数 - 只使用滚动策略
function loadHistoryRecords() {
    if (isLoading) {
        logger.warn('已有一个加载任务正在执行，请等待完成');
        return;
    }
    
    logger.group('开始加载历史记录');
    
    isLoading = true;
    loadHistoryButton.textContent = '加载中...';
    loadHistoryButton.style.background = '#999';
    loadHistoryButton.style.cursor = 'wait';
    
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
        
        // 首先查找所有可滚动容器
        const scrollContainers = findAllScrollContainers();
        logger.info(`找到 ${scrollContainers.length} 个可滚动容器`);
        
        // 记录容器详细信息
        const containerDetails = scrollContainers.map((container, index) => {
            const messageCount = container.querySelectorAll(currentConfig.messageSelector).length;
            return {
                index,
                tagName: container.tagName,
                className: container.className,
                width: container.clientWidth,
                height: container.clientHeight,
                scrollHeight: container.scrollHeight,
                messageCount
            };
        });
        
        logger.debug('可滚动容器详情:');
        logger.table(containerDetails);
        
        // 找出包含最多消息的容器作为主要滚动容器
        let bestContainer = null;
        let maxMessages = 0;
        
        for (const container of scrollContainers) {
            const messageCount = container.querySelectorAll(currentConfig.messageSelector).length;
            
            if (messageCount > maxMessages) {
                maxMessages = messageCount;
                bestContainer = container;
            }
        }
        
        // 执行滚动操作
        if (bestContainer) {
            logger.success(`找到最佳消息容器: ${bestContainer.tagName}.${bestContainer.className}`);
            logger.debug(`滚动前位置: ${bestContainer.scrollTop}px, 总高度: ${bestContainer.scrollHeight}px`);
            
            // 保存原始滚动位置
            const originalScrollTop = bestContainer.scrollTop;
            
            // 执行滚动到顶部
            const maxScrollAttempts = 3;
            for (let i = 0; i < maxScrollAttempts; i++) {
                logger.debug(`滚动尝试 ${i+1}/${maxScrollAttempts}`);
                bestContainer.scrollTo({top: 0, behavior: 'auto'});
                
                // 确保滚动生效
                bestContainer.scrollTop = 0; // 直接设置，确保滚动生效
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // 如果已经到顶部，退出循环
                if (bestContainer.scrollTop < 10) {
                    logger.success('已滚动到顶部或接近顶部');
                    break;
                } else {
                    logger.warn(`滚动后位置: ${bestContainer.scrollTop}px, 再次尝试`);
                }
            }
            
            // 等待内容加载
            logger.debug('等待内容加载 (2s)...');
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // 触发滚动事件以确保内容加载
            logger.debug('触发滚动事件以确保内容加载');
            bestContainer.dispatchEvent(new Event('scroll', {bubbles: true}));
            
            // 再次等待
            logger.debug('再次等待 (1s)...');
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // 如果是最后一次尝试，恢复滚动位置
            if (attempts >= 2) {
                logger.debug(`恢复原始滚动位置: ${originalScrollTop}px`);
                bestContainer.scrollTo({top: originalScrollTop, behavior: 'auto'});
            }
        } else {
            logger.warn('未找到合适的消息容器，尝试全局滚动');
            // 全局滚动到顶部
            window.scrollTo({top: 0, behavior: 'auto'});
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        // 更新问题列表
        logger.debug('重新查找问题...');
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
            logger.success(`加载完成: 从${initialQuestionCount}条增加到${questions.length}条，新增${newQuestions}条`);
            
            // 重置按钮状态
            isLoading = false;
            loadHistoryButton.textContent = '加载历史记录';
            loadHistoryButton.style.background = '#4CAF50';
            loadHistoryButton.style.cursor = 'pointer';
            
            // 显示加载结果消息
            if (newQuestions > 0) {
                alert(`成功加载了${newQuestions}条新的历史记录！`);
            } else {
                alert('没有找到新的历史记录，可能已经加载了全部历史或需要刷新页面。');
            }
            
            // 滚动回原来的位置
            logger.debug(`恢复页面滚动位置: ${scrollPosition}px`);
            window.scrollTo({top: scrollPosition, behavior: 'auto'});
            
            logger.groupEnd(); // 关闭主组
        } else if (attempts < 2) {
            // 短暂延迟后再次尝试
            logger.debug('短暂延迟后再次尝试...');
            setTimeout(() => {
                tryLoadHistory(attempts + 1);
            }, 2000);
        }
    };
    
    // 开始第一次尝试
    tryLoadHistory(1);
}
```

## 7. 修改页面加载初始化
```javascript
// 页面加载后初始化
window.addEventListener('load', () => {
    logger.group('脚本初始化');
    logger.info('webAI聊天问题列表导航脚本测试版已加载');
    logger.info('当前网站:', hostname);
    logger.info('当前配置:', currentConfig);
    
    setTimeout(() => {
        findAllQuestionsWithDeduplication();
        logger.success(`初始问题列表加载完成，共找到${questions.length}个问题`);
        setupInputListener();
        
        // 添加键盘快捷键支持 - Alt+Q 显示/隐藏问题列表
        document.addEventListener('keydown', (e) => {
            if (e.altKey && e.key === 'q') {
                logger.debug('检测到快捷键: Alt+Q');
                button.click();
            }
        });
        
        logger.debug('已设置键盘快捷键 Alt+Q 用于显示/隐藏问题列表');
        logger.groupEnd();
    }, 2000);
});
```

## 完整测试版脚本
上述修改点添加到原脚本中，将会创建一个具有详细日志功能和配置测试功能的测试版脚本。主要差异包括：

1. 增加配置测试按钮和功能
2. 增强日志系统，包括彩色日志和分组
3. 提供更详细的日志信息
4. 增加元素分析和配置生成功能
5. 脚本标记为测试版

请保留原脚本的其他功能和基础结构不变。 