(function () {
  'use strict';
  var cfg = window.AGENT_CONFIG || {};
  var flowIdx = 0;
  var phase = 'flow'; // flow | generating | output
  var genTimer = null;

  function $(id) { return document.getElementById(id); }
  function shellReady(fn) {
    if ($('agentShellContent') && $('agentShellSteps') && $('agentShellPrimaryBtn')) fn();
    else setTimeout(function () { shellReady(fn); }, 100);
  }

  function genIdx() {
    var steps = cfg.steps || [];
    return Math.max(2, steps.indexOf('生成中') + 1);
  }
  function lastIdx() { return (cfg.steps || []).length; }

  function bindCharCount(el) {
    el.addEventListener('input', function () {
      var cc = el.closest('.af-form-field').querySelector('.af-char-count');
      if (cc) cc.textContent = this.value.length + '/' + (this.getAttribute('maxlength') || '');
    });
  }

  function renderForm() {
    var f = cfg.form || {};
    var html = '<div class="af-card"><div class="af-form-section-title">' + (f.title || '项目基础信息') + '</div>';
    (f.fields || []).forEach(function (fd) {
      var req = fd.required ? '<span class="req">*</span>' : '';
      var cc = fd.max ? '<span class="af-char-count">0/' + fd.max + '</span>' : '';
      var hint = fd.hint ? '<div class="af-hint">' + fd.hint + '</div>' : '';
      if (fd.type === 'select') {
        var opts = (fd.options || []).map(function (o) {
          return '<option' + (o === fd.value ? ' selected' : '') + '>' + o + '</option>';
        }).join('');
        html += '<div class="af-form-field"><label>' + fd.label + req + cc + '</label>'
          + '<select class="af-input">' + opts + '</select>' + hint + '</div>';
      } else if (fd.type === 'textarea') {
        html += '<div class="af-form-field"><label>' + fd.label + req + cc + '</label>'
          + '<textarea class="af-input" rows="3"' + (fd.max ? ' maxlength="' + fd.max + '"' : '') + ' placeholder="' + (fd.placeholder || '') + '"></textarea>'
          + hint + '</div>';
      } else {
        html += '<div class="af-form-field"><label>' + fd.label + req + cc + '</label>'
          + '<input class="af-input" type="text"' + (fd.max ? ' maxlength="' + fd.max + '"' : '') + ' placeholder="' + (fd.placeholder || '') + '">'
          + hint + '</div>';
      }
    });
    html += '</div>';
    if (cfg.dims && cfg.dims.length) {
      html += '<div class="af-card"><div class="af-form-section-title">报告维度说明</div><div class="af-dims">'
        + cfg.dims.map(function (d) {
          return '<div class="af-dim"><div class="af-dim-title">' + d.title + '</div><div class="af-dim-desc">' + d.desc + '</div></div>';
        }).join('') + '</div></div>';
    }
    if (cfg.note) {
      html += '<div class="af-card" style="font-size:13px;color:#888;line-height:1.7;">' + cfg.note + '</div>';
    }
    $('agentShellContent').innerHTML = html;
    $('agentShellContent').querySelectorAll('.af-input').forEach(bindCharCount);
  }

  function renderUpload() {
    var html = '<div class="af-card"><div class="af-form-section-title">上传项目信息</div>'
      + '<div class="af-upload-area" id="afUploadArea">'
      +   '<div class="af-upload-icon">📄</div>'
      +   '<div class="af-upload-main">点击或拖动文件至此区域</div>'
      +   '<div class="af-upload-sub">仅支持 .docx 格式，文件大小 ≤ 2M</div>'
      + '</div>'
      + '<div class="af-upload-file" id="afUploadFile"><span>📄</span><span class="af-file-name" id="afFileName"></span><span class="af-file-del" onclick="resetUpload()">✕</span></div>'
      + '<div class="af-upload-tip">请先使用平台提供的模板进行内容编辑：'
      +   '<button class="af-btn af-btn-outline af-btn-sm" onclick="downloadTpl()">下载模板</button><br>'
      +   '文件仅支持 <b>.docx</b> 文件上传，请使用下载模板进行编辑，不要改变文件格式；且文件大小需限制 <b>≤ 2M</b></div>'
      + '</div>';
    var content = $('agentShellContent');
    content.innerHTML = html;
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = '.docx';
    input.style.display = 'none';
    content.appendChild(input);
    var area = $('afUploadArea');
    function setFile(f) {
      if (!f) return;
      $('afFileName').textContent = f.name;
      $('afUploadFile').classList.add('show');
    }
    area.onclick = function () { input.click(); };
    input.onchange = function () { setFile(input.files[0]); };
    area.addEventListener('dragover', function (e) { e.preventDefault(); });
    area.addEventListener('drop', function (e) {
      e.preventDefault();
      setFile(e.dataTransfer.files[0]);
    });
    window.resetUpload = function () {
      $('afUploadFile').classList.remove('show');
      input.value = '';
    };
    window.downloadTpl = function () { window.shellToast && shellToast('模板下载（原型演示）'); };
  }

  function renderGenerating() {
    phase = 'generating';
    window.setAgentStep(genIdx());
    window.setAgentFoot({});
    var html = '<div class="af-card"><div class="af-gen">'
      + '<div class="af-gen-spinner"></div>'
      + '<div class="af-gen-title">我们正在为您精心定制报告</div>'
      + '<div class="af-gen-desc">每份报告都需经过大量数据检索、严谨的逻辑分析和结构化撰写，请稍候，生成后会第一时间通知您。</div>'
      + '<div class="af-gen-progress"><div class="af-gen-progress-bar" id="afGenBar"></div></div>'
      + '<div class="af-gen-status" id="afGenStatus">0%</div>'
      + '<div class="af-gen-queue" id="afGenQueue">排队中：第 4/25 位，预计生成时间 ' + (cfg.genMinutes || 30) + ' 分钟</div>'
      + '</div></div>';
    $('agentShellContent').innerHTML = html;
    var p = 0;
    genTimer = setInterval(function () {
      p = Math.min(100, p + Math.random() * 14 + 5);
      $('afGenBar').style.width = p + '%';
      $('afGenStatus').textContent = '生成中：当前进度 ' + Math.round(p) + '%';
      if (p >= 100) {
        clearInterval(genTimer);
        setTimeout(renderOutput, 700);
      }
    }, 500);
  }

  function renderOutput() {
    phase = 'output';
    window.setAgentStep(lastIdx());
    window.setAgentFoot({});
    var html = '<div class="af-card"><div class="af-output">'
      + '<div class="af-output-icon">✓</div>'
      + '<div class="af-output-title">报告已生成</div>'
      + '<div class="af-output-sub">' + (cfg.name || '报告') + ' 已生成完毕，可下载查看或重新编辑</div>'
      + '<div class="af-output-report"><span>📄</span>' + (cfg.reportName || ((cfg.name || '报告') + '·正式报告')) + '</div>'
      + '<div class="af-output-actions">'
      +   '<button class="af-btn af-btn-outline" onclick="regenerate()">重新编辑</button>'
      +   '<button class="af-btn af-btn-primary" onclick="downloadReport()">下载报告</button>'
      + '</div>'
      + '<div class="af-feedback"><div class="af-feedback-title">期待您的反馈</div>'
      +   '<div class="af-stars">★★★★★</div>'
      +   '<textarea class="af-input" rows="2" placeholder="请留下您的宝贵意见"></textarea>'
      +   '<div style="text-align:right;margin-top:12px;"><button class="af-btn af-btn-outline af-btn-sm" onclick="submitFeedback()">确认反馈</button></div>'
      + '</div>'
      + '</div></div>';
    $('agentShellContent').innerHTML = html;
    window.regenerate = function () {
      flowIdx = 0;
      phase = 'flow';
      renderCurrent();
    };
    window.downloadReport = function () { window.shellToast && shellToast('报告下载（原型演示）'); };
    window.submitFeedback = function () { window.shellToast && shellToast('感谢您的反馈'); };
  }

  function renderCurrent() {
    var s = (cfg.flow || [])[flowIdx];
    if (!s) { renderGenerating(); return; }
    window.setAgentStep(flowIdx + 1);
    if (s.key === 'upload') renderUpload(); else renderForm();
    window.setAgentFoot({
      secondary: true,
      secondaryText: '保存内容',
      secondary: function () { window.shellToast && shellToast('内容已保存（原型演示）'); },
      primaryText: s.primary || '下一步',
      primary: function () {
        if (flowIdx < (cfg.flow || []).length - 1) {
          flowIdx++;
          renderCurrent();
        } else {
          renderGenerating();
        }
      }
    });
  }

  shellReady(function () {
    var params = new URLSearchParams(location.search);
    var phase = params.get('phase');
    if (phase === 'gen') renderGenerating();
    else if (phase === 'done') renderOutput();
    else renderCurrent();
  });
})();
