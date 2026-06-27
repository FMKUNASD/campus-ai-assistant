const views = {
  qa: "校园问答",
  plan: "学习计划",
  analysis: "能耗分析",
};

const campusPower = [
  { name: "教学楼A", value: 328 },
  { name: "图书馆", value: 286 },
  { name: "实验楼", value: 412 },
  { name: "食堂", value: 245 },
  { name: "宿舍区", value: 376 },
];

const apiPresets = {
  mock: {
    status: "离线演示模式",
    url: "local-demo",
    model: "demo-rule-model",
  },
  ollama: {
    status: "Ollama 本地模型",
    url: "http://localhost:11434",
    model: "qwen2.5:7b",
  },
  doubao: {
    status: "豆包（火山方舟）",
    url: "https://ark.cn-beijing.volces.com/api/v3",
    model: "请填写火山方舟模型或接入点ID",
  },
  deepseek: {
    status: "DeepSeek 云端模型",
    url: "https://api.deepseek.com",
    model: "deepseek-chat",
  },
  openai: {
    status: "OpenAI 兼容接口",
    url: "https://api.openai.com",
    model: "gpt-4o-mini",
  },
};

const $ = (id) => document.getElementById(id);

document.querySelectorAll(".nav-item").forEach((button) => {
  button.addEventListener("click", () => {
    activateView(button.dataset.view);
    location.hash = button.dataset.view;
  });
});

function activateView(view) {
  if (!views[view]) view = "qa";
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.toggle("active", item.dataset.view === view);
  });
  document.querySelectorAll(".view").forEach((panel) => panel.classList.remove("active"));
  $(`view-${view}`).classList.add("active");
  $("viewTitle").textContent = views[view];
}

$("apiType").addEventListener("change", () => {
  applyApiPreset($("apiType").value);
});

function applyApiPreset(type) {
  const preset = apiPresets[type] || apiPresets.mock;
  $("statusPill").textContent = preset.status;
  $("apiUrl").value = preset.url;
  $("modelName").value = preset.model;
  if (type === "mock" || type === "ollama") {
    $("apiKey").value = "";
  }
}

async function callModel(prompt) {
  const type = $("apiType").value;
  const apiUrl = $("apiUrl").value.replace(/\/$/, "");
  const model = $("modelName").value.trim();
  const apiKey = $("apiKey").value.trim();

  if (type === "mock") {
    return mockAnswer(prompt);
  }

  if (!model || model.includes("请填写")) {
    return "请先填写正确的模型名称。豆包模式需要填写火山方舟控制台里的模型或接入点 ID。";
  }

  try {
    if (type === "ollama") {
      const response = await fetch(`${apiUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt }],
          stream: false,
        }),
      });
      const data = await response.json();
      return data.message?.content || "本地模型没有返回内容。";
    }

    if (!apiKey) {
      return "请先填写 API Key。云端接口需要密钥才能调用。";
    }

    const endpoint =
      type === "doubao" || type === "deepseek"
        ? `${apiUrl}/chat/completions`
        : `${apiUrl}/v1/chat/completions`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: "你是智慧校园助手，回答要简洁、具体、适合大学生使用。",
          },
          { role: "user", content: prompt },
        ],
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return data.error?.message || `模型接口调用失败，状态码：${response.status}`;
    }
    return data.choices?.[0]?.message?.content || "云端模型没有返回内容。";
  } catch (error) {
    return `模型接口暂时不可用，已切换为演示回复：\n${mockAnswer(prompt)}`;
  }
}

function runCampusAgent(prompt) {
  const text = prompt.toLowerCase();
  const tools = [];

  if (hasAny(prompt, ["能耗", "用电", "数据", "节能", "分析"]) || text.includes("power")) {
    tools.push("能耗数据分析工具");
    return `${agentHeader("数据分析", tools)}
${buildEnergyAnalysis()}`;
  }

  if (hasAny(prompt, ["计划", "复习", "安排", "学习", "路线", "下午", "考试"])) {
    tools.push("学习计划生成工具", "校园路线建议工具");
    return `${agentHeader("学习规划", tools)}
${buildStudyPlan(prompt)}`;
  }

  if (hasAny(prompt, ["吃饭", "食堂", "午饭", "晚饭", "早餐"])) {
    tools.push("校园生活问答工具");
    return `${agentHeader("校园生活问答", tools)}
建议优先选择离当前上课地点最近的食堂窗口。若是中午 12:00-12:30，食堂会比较拥挤，可以提前 10 分钟或错峰就餐。饭后如果还要学习，路线可以安排为：食堂 -> 图书馆/自习室 -> 宿舍。`;
  }

  if (hasAny(prompt, ["图书馆", "自习", "座位", "借书"])) {
    tools.push("图书馆问答工具");
    return `${agentHeader("图书馆问答", tools)}
如果目标是安静学习，建议去图书馆自习区；如果需要讨论项目，可以选择公共讨论区。进入前先确认座位和开放时间，离开时记得带走个人物品。`;
  }

  if (hasAny(prompt, ["社团", "活动", "比赛", "讲座"])) {
    tools.push("校园活动问答工具");
    return `${agentHeader("校园活动问答", tools)}
可以优先关注学院群、学校通知和社团公告。建议选择与专业相关的科技竞赛、创新创业活动，也可以参加文体类社团放松。`;
  }

  tools.push("通用校园问答工具");
  return `${agentHeader("通用问答", tools)}
我可以帮你处理校园问答、学习计划和能耗分析。你可以直接问：“在哪里吃饭”“帮我制定复习计划”“分析一下校园能耗数据”。`;
}

function agentHeader(intent, tools) {
  return `【校园智能体】
识别意图：${intent}
调用工具：${tools.join("、")}`;
}

function hasAny(text, words) {
  return words.some((word) => text.includes(word));
}

function buildStudyPlan(prompt) {
  return `建议学习路线：
1. 14:00-14:40：在图书馆或自习室复习课堂笔记，先整理知识点。
2. 14:50-15:40：完成课程作业或项目代码，优先处理最重要的任务。
3. 16:00-16:40：调试系统功能，检查问答、学习计划和能耗分析是否能正常演示。
4. 16:40-17:30：整理 README、系统说明手册、截图和 Git 提交记录。

提醒：如果中途需要讨论，可以把图书馆自习区换成公共讨论区；如果临近饭点，建议先保存进度再去食堂。`;
}

function buildEnergyAnalysis() {
  const total = campusPower.reduce((sum, item) => sum + item.value, 0);
  const peak = campusPower.reduce((best, item) => (item.value > best.value ? item : best), campusPower[0]);
  const sorted = [...campusPower].sort((a, b) => b.value - a.value);
  return `本次样例数据共统计 ${campusPower.length} 个校园区域，总用电量为 ${total} kWh。
用电最高区域：${peak.name}，用电量 ${peak.value} kWh。
用电排序：${sorted.map((item) => `${item.name} ${item.value}kWh`).join("，")}。

节能建议：
1. 实验楼用电最高，建议课后关闭实验设备待机电源。
2. 宿舍区晚间用电较高，可加强空调、照明和插座安全提醒。
3. 图书馆和教学楼可按楼层统计照明使用情况，减少无人区域照明浪费。`;
}

function mockAnswer(prompt) {
  if (prompt.includes("吃饭") || prompt.includes("食堂") || prompt.includes("午饭") || prompt.includes("晚饭")) {
    return "可以优先去学校食堂就餐。时间比较紧的话建议选择离教学楼最近的一楼快餐窗口；想安静一点可以错开 12:00-12:30 的高峰期。饭后如果还要学习，可以直接去图书馆或自习室。";
  }
  if (prompt.includes("图书馆") || prompt.includes("自习")) {
    return "如果想安静学习，建议去图书馆自习区；如果需要讨论项目，可以选择公共讨论区。进入前先确认座位和开放时间，离开时记得带走个人物品。";
  }
  if (prompt.includes("计划") || prompt.includes("复习")) {
    return "建议安排：14:00-14:40 复习课堂笔记；14:50-15:40 完成核心代码或文档；16:00-16:40 调试演示流程；16:40-17:30 整理截图、提交记录和 README。";
  }
  if (prompt.includes("能耗") || prompt.includes("数据")) {
    return buildEnergyAnalysis();
  }
  return "这是离线演示回复：我可以回答校园问答、学习计划、图书馆自习、食堂就餐、社团活动和能耗分析等问题。";
}

function addMessage(text, role) {
  const node = document.createElement("div");
  node.className = `message ${role}`;
  node.textContent = text;
  $("chatLog").appendChild(node);
  $("chatLog").scrollTop = $("chatLog").scrollHeight;
}

$("qaSend").addEventListener("click", async () => {
  const text = $("qaInput").value.trim();
  if (!text) return;
  addMessage(text, "user");
  addMessage("正在生成回答...", "bot");
  const answer = await callModel(`校园问答：${text}`);
  $("chatLog").lastElementChild.textContent = answer;
});

$("planBtn").addEventListener("click", async () => {
  const prompt = `请为课程《${$("courseName").value}》生成学习计划。空闲时间：${$("freeTime").value}。目标：${$("studyGoal").value}。`;
  $("planOutput").textContent = "正在生成计划...";
  $("planOutput").textContent = await callModel(prompt);
});

$("analysisBtn").addEventListener("click", async () => {
  const total = campusPower.reduce((sum, item) => sum + item.value, 0);
  const peak = campusPower.reduce((best, item) => (item.value > best.value ? item : best), campusPower[0]);
  $("totalPower").textContent = total;
  $("peakRoom").textContent = peak.name;
  $("saveRate").textContent = "8%-12%";
  drawChart();
  const prompt = `请分析校园楼宇用电数据并给出三条节能建议：${JSON.stringify(campusPower)}`;
  $("analysisOutput").textContent = "正在分析数据...";
  $("analysisOutput").textContent = await callModel(prompt);
});

function drawChart() {
  const max = Math.max(...campusPower.map((item) => item.value));
  $("barChart").innerHTML = "";
  campusPower.forEach((item) => {
    const row = document.createElement("div");
    row.className = "bar-row";
    row.innerHTML = `
      <span>${item.name}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${(item.value / max) * 100}%"></div></div>
      <span>${item.value}</span>
    `;
    $("barChart").appendChild(row);
  });
}

drawChart();

function bootFromHash() {
  const view = location.hash.replace("#", "");
  activateView(view || "qa");
  applyApiPreset($("apiType").value);
  if (new URLSearchParams(location.search).get("demo") === "1") {
    $("planOutput").textContent = mockAnswer("计划 复习");
    $("analysisBtn").click();
  }
}

window.addEventListener("hashchange", bootFromHash);
bootFromHash();
