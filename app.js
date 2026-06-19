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
  const type = $("apiType").value;
  $("statusPill").textContent =
    type === "mock" ? "离线演示模式" : type === "ollama" ? "Ollama 本地模型" : "OpenAI 兼容接口";
});

async function callModel(prompt) {
  const type = $("apiType").value;
  const apiUrl = $("apiUrl").value.replace(/\/$/, "");
  const model = $("modelName").value.trim();
  const apiKey = $("apiKey").value.trim();

  if (type === "mock") {
    return mockAnswer(prompt);
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

    const response = await fetch(`${apiUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: "你是智慧校园助手，回答要简洁、具体、适合大学生使用。" },
          { role: "user", content: prompt },
        ],
      }),
    });
    const data = await response.json();
    return data.choices?.[0]?.message?.content || "云端模型没有返回内容。";
  } catch (error) {
    return `模型接口暂时不可用，已切换为演示回复：\n${mockAnswer(prompt)}`;
  }
}

function mockAnswer(prompt) {
  const text = prompt.toLowerCase();
  if (prompt.includes("吃饭") || prompt.includes("食堂") || prompt.includes("午饭") || prompt.includes("晚饭")) {
    return "可以优先去学校食堂就餐。时间比较紧的话建议选择离教学楼最近的一楼快餐窗口；想安静一点可以错开 12:00-12:30 的高峰期。饭后如果还要学习，可以直接去图书馆或自习室。";
  }
  if (prompt.includes("图书馆") || prompt.includes("自习")) {
    return "如果想安静学习，建议去图书馆自习区；如果需要讨论项目，可以选择公共讨论区。进入前先确认座位和开放时间，离开时记得带走个人物品。";
  }
  if (prompt.includes("社团") || prompt.includes("活动")) {
    return "可以关注学校社团通知、学院群和校园活动公告。建议优先参加和专业相关的科技类、创新创业类活动，也可以参加文体类活动放松。";
  }
  if (prompt.includes("上课") || prompt.includes("教室") || prompt.includes("路线")) {
    return "建议先确认课程表上的教学楼和教室号，再预留 10-15 分钟到达。如果课后还要完成作业，可以把路线安排为：教室 -> 图书馆/自习室 -> 食堂。";
  }
  if (prompt.includes("计划") || prompt.includes("复习")) {
    return "建议安排：14:00-14:40 复习课堂笔记；14:50-15:40 完成核心代码或文档；16:00-16:40 调试演示流程；16:40-17:30 整理截图、提交记录和 README。";
  }
  if (prompt.includes("能耗") || prompt.includes("数据") || text.includes("power")) {
    return "从样例数据看，实验楼和宿舍区用电较高。建议在课后关闭实验设备待机电源，并按楼层统计晚间照明使用情况。";
  }
  return "这是离线演示回复：我可以回答校园问答、学习计划、图书馆自习、食堂就餐、社团活动和能耗分析等问题。如果想让每次回答都更智能，需要在左侧切换到 Ollama 本地模型或 OpenAI 兼容接口。";
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
  if (new URLSearchParams(location.search).get("demo") === "1") {
    $("planOutput").textContent = mockAnswer("计划 复习");
    $("analysisBtn").click();
  }
}

window.addEventListener("hashchange", bootFromHash);
bootFromHash();
