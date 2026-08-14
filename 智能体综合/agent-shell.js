(function () {
  'use strict';
  var built = false;

  /* 侧栏展开/收起（与工作台一致，状态跨页面记忆） */
  window.toggleSidebar = function () {
    document.body.classList.toggle('sidebar-collapsed');
    try { localStorage.setItem('wbdmSidebarCollapsed', document.body.classList.contains('sidebar-collapsed') ? '1' : '0'); } catch (e) {}
  };
  (function initSidebarCollapse() {
    try { if (localStorage.getItem('wbdmSidebarCollapsed') === '1') document.body.classList.add('sidebar-collapsed'); } catch (e) {}
  })();

  /* 简单提示 */
  function shellToast(msg) {
    var old = document.querySelector('.agent-shell-toast');
    if (old) old.remove();
    var t = document.createElement('div');
    t.className = 'agent-shell-toast';
    t.textContent = msg;
    document.body.appendChild(t);
    requestAnimationFrame(function () { t.style.opacity = '1'; });
    setTimeout(function () {
      t.style.opacity = '0';
      setTimeout(function () { t.remove(); }, 250);
    }, 1600);
  }

  /* 供流程页调用：更新顶部步骤高亮 */
  window.setAgentStep = function (n) {
    var wrap = document.getElementById('agentShellSteps');
    if (!wrap) return;
    Array.prototype.forEach.call(wrap.querySelectorAll('.agent-shell-step'), function (p, i) {
      p.classList.toggle('active', i + 1 === n);
      p.classList.toggle('done', i + 1 < n);
    });
  };
  /* 供流程页调用：配置底部操作栏 */
  window.setAgentFoot = function (opts) {
    opts = opts || {};
    var primary = document.getElementById('agentShellPrimaryBtn');
    var secondary = document.getElementById('agentShellSecondaryBtn');
    if (primary) {
      if (opts.primary) {
        primary.textContent = opts.primaryText || '下一步';
        primary.style.display = '';
        primary.onclick = opts.primary;
      } else {
        primary.style.display = 'none';
        primary.onclick = null;
      }
    }
    if (secondary) {
      if (opts.secondary) {
        secondary.textContent = opts.secondaryText || '保存内容';
        secondary.style.display = '';
        secondary.onclick = opts.secondary;
      } else {
        secondary.style.display = 'none';
        secondary.onclick = null;
      }
    }
  };

  /* 隐藏 Axure 自带的旧界面元件（侧栏条目、顶栏、客服浮层、弹窗等），仅保留正文内容面板 */
  var firstContentTop = null;
  function applyHideChrome() {
    var base = document.getElementById('base');
    if (!base) return false;
    var kids = Array.prototype.slice.call(base.children).filter(function (el) { return el.id && /^u\d+$/.test(el.id); });
    var anyReady = false;
    var keep = [];
    kids.forEach(function (el) {
      var rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) anyReady = true;
      // 正文内容面板/背景：宽 >=800、高 >=800、位于内容区（原始画布坐标系）
      if (rect.left >= 150 && rect.width >= 800 && rect.height >= 800) keep.push(el);
    });
    if (!anyReady) return false;
    if (!keep.length) return false;
    kids.forEach(function (el) {
      if (keep.indexOf(el) >= 0) return;
      el.style.display = 'none';
    });
    // 卡片样式加在正文内容面板上（含文本的大面板），并隐藏其后的纯背景板
    var cardEl = null;
    keep.forEach(function (el) {
      if (!cardEl && (el.innerText || '').trim()) cardEl = el;
    });
    if (cardEl) {
      cardEl.classList.add('agent-shell-card');
      keep.forEach(function (el) { if (el !== cardEl) el.style.display = 'none'; });
    } else {
      keep.forEach(function (el) { el.classList.add('agent-shell-card'); });
    }
    hideOldSteps();
    measureFirstContentTop();
    document.body.classList.add('agent-shelled');
    document.documentElement.style.overflowX = 'hidden';
    document.body.style.overflowX = 'hidden';
    fitContent();
    return true;
  }

  /* 隐藏 Axure 内容区自带的旧步骤条（所有面板状态：第一步/第二步/完成、耗时文字、连接线、注解角标） */
  function hideOldSteps() {
    document.querySelectorAll('#base [id^="u"]').forEach(function (el) {
      if (!el.id) return;
      if (el.classList.contains('panel_state') || el.classList.contains('panel_state_content')) return;
      var it = (el.innerText || '').trim();
      var tt = (el.textContent || '').trim();
      var isStep = /^(第一步|第二步|完成)\s*\n/.test(it)
        || /^(第一步|第二步)/.test(tt)
        || /^完成完整报告输出/.test(tt)
        || /^大约需要/.test(it)
        || /^大约需要/.test(tt);
      if (isStep && tt.length < 200) {
        el.style.display = 'none';
        return;
      }
      // Axure 注解角标（1/2/3 红点）
      if (/_ann$/.test(el.id) || (el.className || '').toString().indexOf('annnote') >= 0) {
        el.style.display = 'none';
        return;
      }
      // 步骤胶囊之间的连接线（细横条）
      if (!it && !tt) {
        var r = el.getBoundingClientRect();
        if (r.width >= 20 && r.height > 0 && r.height <= 6 && r.top >= 60 && r.top <= 200 && r.left >= 350 && r.left <= 1500) {
          el.style.display = 'none';
        }
      }
    });
  }

  /* 记录隐藏旧步骤条后首个可见内容（提示语等）的原始顶部位置，用于消除上方空白 */
  function measureFirstContentTop() {
    var best = null;
    document.querySelectorAll('#base [id^="u"]').forEach(function (el) {
      if (!el.id) return;
      if (!(el.innerText || '').trim()) return;
      if (getComputedStyle(el).display === 'none') return;
      if (/_ann$/.test(el.id)) return; // 跳过注解角标
      if ((el.innerText || '').trim().length > 200) return; // 跳过容器文本
      var r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        if (best === null || r.top < best) best = r.top;
      }
    });
    if (best !== null) firstContentTop = best;
  }

  /* 底部固定操作栏：主操作按钮（下一步/生成报告/跳过） */
  var PRIMARY_TEXTS = ['下一步', '生成报告', '跳过'];
  var primaryEl = null;
  var secondaryEl = null;
  function findPrimaryBtn() {
    var found = null;
    var order = 99;
    document.querySelectorAll('#base [id^="u"]').forEach(function (el) {
      if (!el.id) return;
      var t = (el.innerText || '').trim();
      if (!t) return;
      var idx = PRIMARY_TEXTS.indexOf(t);
      if (idx < 0) return;
      if (getComputedStyle(el).display === 'none') return;
      var r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && idx < order) {
        order = idx;
        found = el;
      }
    });
    return found;
  }
  function syncPrimaryBtn() {
    var btn = document.getElementById('agentShellPrimaryBtn');
    if (!btn) return;
    var el = findPrimaryBtn() || primaryEl;
    // 隐藏内容区内的主操作按钮（用 visibility 隐藏，保留可转发点击），统一展示在底部固定栏
    document.querySelectorAll('#base [id^="u"]').forEach(function (e) {
      if (!e.id) return;
      var t = (e.innerText || '').trim();
      if (PRIMARY_TEXTS.indexOf(t) >= 0 && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0) {
        e.style.visibility = 'hidden';
      }
    });
    if (el) {
      primaryEl = el;
      btn.textContent = (el.textContent || el.innerText || '').trim();
      btn.style.display = '';
      btn.onclick = function () { el.click(); };
    } else {
      primaryEl = null;
      btn.style.display = 'none';
    }
  }
  /* 底部固定操作栏：次级操作（保存内容）与主操作同级展示 */
  function syncSecondaryBtn() {
    var btn = document.getElementById('agentShellSecondaryBtn');
    if (!btn) return;
    var el = null;
    document.querySelectorAll('#base [id^="u"]').forEach(function (e) {
      if (!e.id) return;
      var t = (e.innerText || '').trim();
      if (t === '保存内容' && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0) {
        e.style.visibility = 'hidden';
        if (!el) el = e;
      }
    });
    el = el || secondaryEl;
    if (el) {
      secondaryEl = el;
      btn.textContent = (el.textContent || el.innerText || '').trim();
      btn.style.display = '';
      btn.onclick = function () { el.click(); };
    } else {
      secondaryEl = null;
      btn.style.display = 'none';
    }
  }

  /* 正文内容自适应：宽度铺满工作台内容区，顶部对齐；超高时纵向滚动 */
  function fitContent() {
    var base = document.getElementById('base');
    if (!base) return;
    var cw = 1650;   // Axure 正文区设计宽（含最宽元件 1649）
    var ch = 1020;   // Axure 正文区设计高
    var sw = 287;    // 原正文区起点 x
    var sh = 62;     // 原正文区起点 y
    var vw = window.innerWidth || 1920;
    var vh = window.innerHeight || 1080;
    var headerEl = document.querySelector('.agent-shell-header');
    var headH = headerEl ? headerEl.offsetHeight : 60;
    var contentWrap = document.getElementById('agentShellContent');
    if (contentWrap && headerEl) contentWrap.style.top = headH + 'px';
    var availW = Math.max(360, (contentWrap ? contentWrap.clientWidth : vw - 220) - 32);
    var scale = availW / cw;
    var maxScale = 1.5;   // 超高分辨率下限制放大倍数，避免内容过大
    if (scale > maxScale) scale = maxScale;
    var px = 16;
    var first = firstContentTop !== null ? firstContentTop : 165;
    var py = 12 - (first - 62) * scale;
    base.style.transformOrigin = '0 0';
    base.style.transform = 'translate(' + (px - sw * scale).toFixed(2) + 'px,' + (py - sh * scale).toFixed(2) + 'px) scale(' + scale.toFixed(4) + ')';
  }

  /* 各智能体步骤（与页面内流程一致，参照专业版展示） */
  var STEPS_MAP = {
    '可行性研究报告': ['编辑基本信息', '上传项目信息', '生成中', '完整报告输出'],
    '企业全景分析报告': ['编辑基本信息', '生成中', '完整报告输出'],
    '投前咨询分析报告': ['编辑基本信息', '生成中', '完整报告输出'],
    '招商策略分析报告': ['编辑基本信息', '生成中', '完整报告输出'],
    '项目立项报告': ['编辑基本信息', '上传项目信息', '生成中', '完整报告输出'],
    '项目资金申请报告': ['编辑基本信息', '上传项目信息', '生成中', '完整报告输出']
  };
  function stepLabels() {
    return STEPS_MAP[document.title] || ['编辑基本信息', '完整报告输出'];
  }
  /* 通过内容面板当前状态识别步骤 */
  function detectStep() {
    var labels = [];
    document.querySelectorAll('#base .panel_state').forEach(function (s) {
      var r = s.getBoundingClientRect();
      var l = s.getAttribute('data-label') || '';
      if (getComputedStyle(s).display !== 'none' && r.width > 0 && l && l !== '状态 1' && l !== '状态 2') labels.push(l);
    });
    if (!labels.length) return 1;
    var last = stepLabels().length;
    var genIdx = Math.max(2, last - 1);
    function has(re) { return labels.some(function (l) { return re.test(l); }); }
    if (has(/生成/)) return genIdx;
    if (has(/基本信息/)) return 1;
    if (has(/上传完成|草稿|完整报告输出|待评价|评价/)) return last;
    if (has(/项目信息|上传|选择|预览/)) return Math.min(2, last);
    return 1;
  }
  function updateSteps() {
    var wrap = document.getElementById('agentShellSteps');
    if (!wrap) return;
    hideOldSteps(); // 步骤切换后 Axure 可能重置旧步骤/注解，轮询时再次隐藏
    var n = detectStep();
    Array.prototype.forEach.call(wrap.querySelectorAll('.agent-shell-step'), function (p, i) {
      p.classList.toggle('active', i + 1 === n);
      p.classList.toggle('done', i + 1 < n);
    });
    syncPrimaryBtn();
    syncSecondaryBtn();
  }

  var TASKS = [
    { name: '草稿 08-14 09:12', exec: 'draft', viewed: false, step: 1, agent: '可研专业版' },
    { name: '草稿 08-14 10:05', exec: 'draft', viewed: false, step: 2, agent: '可研专业版' },
    { name: '企查查科技_商业大数据可研', exec: 'running', viewed: true, agent: '可研专业版' },
    { name: '某某集团_企业全景尽调分析', exec: 'running', viewed: true, agent: '企业全景分析' },
    { name: '北京笃威尔_智能仓储立项报告', exec: 'done', viewed: false, agent: '项目立项报告' },
    { name: '星云半导体_投前尽调报告', exec: 'done', viewed: false, agent: '投前咨询分析' },
    { name: '园区管委会_招商策略初稿', exec: 'done', viewed: true, agent: '招商策略分析' },
    { name: '华能集团_冷链项目立项报告', exec: 'done', viewed: true, agent: '项目立项报告' },
    { name: '清源能源_新能源可研报告', exec: 'done', viewed: true, exported: true, agent: '可研专业版' },
    { name: '宏远银行_数据治理立项', exec: 'done', viewed: true, exported: true, agent: '项目立项报告' },
    { name: '芯测半导体_投前咨询报告', exec: 'done', viewed: true, agent: '投前咨询分析' },
    { name: '城数集团_智慧城市数据中心立项', exec: 'done', viewed: true, exported: true, agent: '项目立项报告' },
    { name: '光晟科技_光伏组件产线可研', exec: 'done', viewed: true, agent: '可研专业版' },
    { name: '医联物流_医药物流园区立项', exec: 'done', viewed: true, agent: '项目立项报告' },
    { name: '冷链云_冷链企业全景尽调', exec: 'done', viewed: true, agent: '企业全景分析' }
  ];
  var TASK_PAGE = 20;
  var taskPage = 0;
  var taskFilter = 'all';
  var taskLoading = false;

  function taskPriority(t) {
    if (t.exec === 'draft') return 0;
    if (t.exec === 'running') return 1;
    if (t.exec === 'done' && !t.viewed) return 2;
    return 3;
  }
  function taskList() {
    var list = taskFilter === 'all' ? TASKS : TASKS.filter(function (t) { return t.agent === taskFilter; });
    return list.slice().sort(function (a, b) { return taskPriority(a) - taskPriority(b); });
  }

  function renderTaskItem(t) {
    var el = document.createElement('div');
    el.className = 'sidebar-task-item' + (t.exec === 'draft' ? ' draft' : '');
    el.onclick = function () {
      var dot = el.querySelector('.task-view-dot');
      if (dot) dot.classList.add('hide');
      window.location.href = '../report.html?taskId=' + TASKS.indexOf(t);
    };
    // 未查看蓝点：仅当报告已生成（已完成）且尚未点击查看时展示
    var unviewed = t.exec === 'done' && !t.viewed;
    var viewDot = '<span class="task-view-dot' + (unviewed ? '' : ' hide') + '" title="未查看"></span>';
    var ring = t.exec === 'running' ? '<span class="task-load-ring" title="报告生成中"></span>' : '';
    el.innerHTML = viewDot
      + '<span class="sidebar-task-text">' + t.name + '</span>'
      + ring
      + '<span class="sidebar-task-meta">' + t.agent + '</span>'
      + '<span class="task-actions">'
      + '<button class="task-act" title="编辑任务名称" onclick="event.stopPropagation();window.shellToast&&shellToast(\'原型演示\')">✎</button>'
      + '<button class="task-act danger" title="删除任务" onclick="event.stopPropagation();window.shellToast&&shellToast(\'原型演示\')">✕</button>'
      + '</span>';
    return el;
  }

  function ensureTaskLoadingEl() {
    var scroll = document.getElementById('shellTaskScroll');
    var l = document.getElementById('shellTaskLoading');
    if (!l) {
      l = document.createElement('div');
      l.id = 'shellTaskLoading';
      l.className = 'sidebar-task-loading';
      scroll.appendChild(l);
    }
    return l;
  }

  function loadTasks() {
    var scroll = document.getElementById('shellTaskScroll');
    if (!scroll) return;
    var list = taskList();
    var start = taskPage * TASK_PAGE;
    var batch = list.slice(start, start + TASK_PAGE);
    batch.forEach(function (t) { scroll.appendChild(renderTaskItem(t)); });
    taskPage++;
    var l = ensureTaskLoadingEl();
    l.textContent = start + batch.length >= list.length ? '已全部加载' : '加载中…';
    scroll.appendChild(l);
    taskLoading = false;
  }

  function initTasks() {
    taskPage = 0;
    taskLoading = false;
    var scroll = document.getElementById('shellTaskScroll');
    if (scroll) scroll.innerHTML = '';
    loadTasks();
  }

  function buildShell() {
    if (built) return;
    built = true;
    var root = document.getElementById('agentShellRoot');
    if (!root) {
      root = document.createElement('div');
      root.id = 'agentShellRoot';
      document.body.appendChild(root);
    }

    var reportName = document.title || '智能体报告';
    root.innerHTML =
      '<aside class="agent-shell-sidebar sidebar">'
      + '<div class="sidebar-brand" title="返回首页" onclick="window.location.href=\'../home.html\'">'
      +   '<div class="sidebar-brand-logo">5</div>'
      +   '<div class="sidebar-brand-name">5度易链<small>5 DEGREE EASY CHAIN</small></div>'
      +   '<button class="sidebar-collapse-btn" title="收起导航" onclick="event.stopPropagation();window.toggleSidebar()">‹</button>'
      + '</div>'
      + '<div class="sidebar-section sidebar-new-sec">'
      +   '<div class="sidebar-item sidebar-new-report" title="新建报告" onclick="window.location.href=\'../report.html\'">'
      +     '<div class="sidebar-icon">✎</div><span>新建报告</span>'
      +   '</div>'
      + '</div>'
      + '<div class="divider"></div>'
      + '<div class="sidebar-section sidebar-tasks-sec">'
      +   '<div class="sidebar-label-row">'
      +     '<div class="sidebar-label">任务列表</div>'
      +     '<select class="sidebar-task-filter" id="shellTaskFilter" onchange="window.filterShellTasks&&filterShellTasks(this)">'
      +       '<option value="all">全部智能体</option>'
      +       '<option value="可研专业版">可研专业版</option>'
      +       '<option value="项目立项报告">项目立项报告</option>'
      +       '<option value="企业全景分析">企业全景分析</option>'
      +       '<option value="投前咨询分析">投前咨询分析</option>'
      +       '<option value="招商策略分析">招商策略分析</option>'
      +     '</select>'
      +   '</div>'
      +   '<div class="sidebar-task-scroll" id="shellTaskScroll"></div>'
      + '</div>'
      + '<div class="divider"></div>'
      + '<div class="sidebar-section sidebar-bottom-nav">'
      +   '<div class="sidebar-item" onclick="window.location.href=\'../assets.html\'">'
      +     '<div class="sidebar-icon">▤</div><span>报告资产</span>'
      +   '</div>'
      +   '<div class="sidebar-item" onclick="window.location.href=\'../knowledge.html\'">'
      +     '<div class="sidebar-icon">○</div><span>知识库</span>'
      +   '</div>'
      + '</div>'
      + '<div class="sidebar-footer">'
      +   '<div class="sidebar-user" onclick="window.shellToast&&shellToast(\'原型演示\')">'
      +     '<span class="user-avatar">5</span>'
      +     '<span class="user-name">度小满</span>'
      +     '<span class="user-bell" title="消息" onclick="event.stopPropagation();window.shellToast&&shellToast(\'暂无新消息\')">🔔<span class="footer-dot"></span></span>'
      +   '</div>'
      + '</div>'
      + '</aside>'
      + '<header class="agent-shell-header">'
      +   '<div class="agent-shell-head-row">'
      +     '<button class="sidebar-expand-btn" title="展开导航" onclick="window.toggleSidebar()">›</button>'
      +     '<button class="agent-shell-back" title="返回智能体首页" onclick="window.location.href=\'../report.html\'">←</button>'
      +     '<div class="agent-shell-title">' + reportName + '</div>'
      +   '</div>'
      +   '<div class="agent-shell-steps" id="agentShellSteps">'
      +   stepLabels().map(function (s, i) {
            return '<span class="agent-shell-step' + (s === '生成中' ? ' generating' : '') + (i === 0 ? ' active' : '') + '" data-step="' + (i + 1) + '">'
              + '<span class="agent-shell-step-num">' + (i + 1) + '</span>' + s + '</span>';
          }).join('')
      +   '</div>'
      + '</header>'
      + '<footer class="agent-shell-foot">'
      +   '<button class="agent-shell-secondary-btn" id="agentShellSecondaryBtn" style="display:none;">保存内容</button>'
      +   '<button class="agent-shell-primary-btn" id="agentShellPrimaryBtn" style="display:none;">下一步</button>'
      + '</footer>';

    /* 内容区独立滚动容器：位于标题栏与底部操作栏之间 */
    var contentWrap = document.createElement('div');
    contentWrap.className = 'agent-shell-content';
    contentWrap.id = 'agentShellContent';
    root.appendChild(contentWrap);
    var baseEl = document.getElementById('base');
    if (baseEl && baseEl.parentNode !== contentWrap) {
      contentWrap.appendChild(baseEl);
    }

    window.filterShellTasks = function (sel) {
      taskFilter = sel.value;
      initTasks();
    };
    window.shellToast = shellToast;
    if (document.getElementById('base')) {
      updateSteps();
      setInterval(updateSteps, 400);
      syncPrimaryBtn();
      syncSecondaryBtn();
      fitContent();
    } else {
      // 纯页面模式：内容区顶部定位到标题栏下方
      var headerEl = root.querySelector('.agent-shell-header');
      if (headerEl) contentWrap.style.top = headerEl.offsetHeight + 'px';
      window.addEventListener('resize', function () {
        if (headerEl) contentWrap.style.top = headerEl.offsetHeight + 'px';
      });
    }

    var scroll = document.getElementById('shellTaskScroll');
    scroll.addEventListener('scroll', function () {
      if (this.scrollTop + this.clientHeight >= this.scrollHeight - 40) {
        var list = taskList();
        if (taskPage * TASK_PAGE < list.length && !taskLoading) {
          taskLoading = true;
          setTimeout(loadTasks, 400);
        }
      }
    });
    initTasks();
  }

  function tryApply() {
    var base = document.getElementById('base');
    if (!base) {
      // 纯页面模式（无 Axure 内容）：仅构建外壳，内容由 agent-flow.js 渲染
      buildShell();
      return true;
    }
    if (applyHideChrome()) {
      buildShell();
      window.addEventListener('resize', function () { fitContent(); });
      return true;
    }
    return false;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      if (!tryApply()) window.addEventListener('load', function () { tryApply(); });
    });
  } else if (!tryApply()) {
    window.addEventListener('load', function () { tryApply(); });
  }
})();
