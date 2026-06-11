const STORAGE_KEY = "ddl_tasks_v1"
const MAX_TASKS = 200

function pad(num) {
  return num < 10 ? "0" + num : "" + num
}

function formatDate(date) {
  return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate())
}

function getToday() {
  return formatDate(new Date())
}

function parseDateTime(task) {
  return new Date((task.dueDate || getToday()) + "T" + (task.dueTime || "23:59") + ":00")
}

function daysLeft(task) {
  const now = new Date()
  const due = parseDateTime(task)
  return Math.ceil((due.getTime() - now.getTime()) / 86400000)
}

function levelOf(task) {
  if (task.done) return { key: "done", text: "已完成", className: "quiet", score: 0 }
  const left = daysLeft(task)
  const importance = Number(task.importance || 3)
  const pressure = left <= 1 ? 5 : left <= 3 ? 4 : left <= 7 ? 3 : left <= 14 ? 2 : 1
  const score = pressure + importance
  if (score >= 9) return { key: "urgent", text: "立刻处理", className: "danger", score }
  if (score >= 7) return { key: "high", text: "本周重点", className: "warning", score }
  if (score >= 5) return { key: "normal", text: "稳定推进", className: "steady", score }
  return { key: "low", text: "低压安排", className: "quiet", score }
}

function inferType(text) {
  const value = text || ""
  if (/竞赛|比赛|路演|创业/.test(value)) return "竞赛"
  if (/论文|开题|文献|答辩/.test(value)) return "论文"
  if (/实验|报告|作业|习题|homework/i.test(value)) return "作业"
  if (/考试|测验|quiz|exam/i.test(value)) return "考试"
  if (/展示|汇报|ppt|presentation/i.test(value)) return "展示"
  return "任务"
}

function inferTitle(text) {
  let title = (text || "").replace(/\s+/g, " ").trim()
  title = title.replace(/\d{1,2}[月/-]\d{1,2}[日号]?/g, "")
  title = title.replace(/\d{1,2}[:：]\d{2}/g, "")
  title = title.replace(/(明天|后天|今天|今晚|下周[一二三四五六日天]?|周[一二三四五六日天])/g, "")
  title = title.replace(/(截止|提交|ddl|DDL|之前|晚上|上午|下午)/g, "")
  return title.trim() || "新的 DDL"
}

function inferDate(text) {
  const now = new Date()
  const value = text || ""
  if (/今天|今晚/.test(value)) return formatDate(now)
  if (/明天/.test(value)) {
    const date = new Date(now)
    date.setDate(now.getDate() + 1)
    return formatDate(date)
  }
  if (/后天/.test(value)) {
    const date = new Date(now)
    date.setDate(now.getDate() + 2)
    return formatDate(date)
  }
  const md = value.match(/(\d{1,2})[月/-](\d{1,2})[日号]?/)
  if (md) {
    const month = Number(md[1])
    const day = Number(md[2])
    let year = now.getFullYear()
    const date = new Date(year, month - 1, day)
    if (date.getTime() < now.getTime() - 86400000) year += 1
    return year + "-" + pad(month) + "-" + pad(day)
  }
  const week = value.match(/(下周)?周?([一二三四五六日天])/)
  if (week) {
    const map = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 0, 天: 0 }
    const target = map[week[2]]
    const date = new Date(now)
    let diff = target - now.getDay()
    if (diff <= 0 || week[1]) diff += 7
    date.setDate(now.getDate() + diff)
    return formatDate(date)
  }
  return getToday()
}

function inferTime(text) {
  const value = text || ""
  const matched = value.match(/(\d{1,2})[:：](\d{2})/)
  if (matched) return pad(Number(matched[1])) + ":" + matched[2]
  if (/晚上|今晚/.test(value)) return "23:00"
  if (/下午/.test(value)) return "18:00"
  if (/上午/.test(value)) return "10:00"
  return "23:59"
}

function createTaskFromText(text) {
  const type = inferType(text)
  const estimate = type === "竞赛" || type === "论文" ? 18 : type === "考试" ? 8 : 4
  return normalizeTask({
    title: inferTitle(text),
    course: "",
    type,
    dueDate: inferDate(text),
    dueTime: inferTime(text),
    importance: type === "竞赛" || type === "论文" ? 5 : 4,
    estimateHours: estimate,
    progress: 0,
    done: false,
    shared: false,
    remindOffsets: estimate >= 12 ? [10080, 2880, 360] : [1440, 180, 30]
  })
}

function normalizeTask(task) {
  return Object.assign({
    id: "task-" + Date.now() + "-" + Math.floor(Math.random() * 10000),
    title: "未命名任务",
    course: "",
    type: "任务",
    dueDate: getToday(),
    dueTime: "23:59",
    importance: 3,
    estimateHours: 2,
    progress: 0,
    done: false,
    shared: false,
    remindOffsets: [1440, 180],
    createdAt: new Date().toISOString()
  }, task)
}

function loadTasks() {
  const tasks = wx.getStorageSync(STORAGE_KEY)
  if (!Array.isArray(tasks)) return []
  const cleaned = tasks
    .filter(task => task && task.id && task.id.indexOf("seed-") !== 0)
    .map(task => normalizeTask(task))
    .filter(task => !Number.isNaN(parseDateTime(task).getTime()))
    .slice(0, MAX_TASKS)
  if (cleaned.length !== tasks.length) wx.setStorageSync(STORAGE_KEY, cleaned)
  return cleaned
}

function saveTasks(tasks) {
  wx.setStorageSync(STORAGE_KEY, tasks)
}

function splitPlan(task) {
  const type = task.type || inferType(task.title)
  const left = Math.max(daysLeft(task), 1)
  const stages = type === "竞赛"
    ? ["明确主题与分工", "资料调研", "方案设计", "材料成稿", "演示打磨"]
    : type === "论文"
      ? ["确定题目", "文献梳理", "提纲搭建", "初稿撰写", "修改定稿"]
      : type === "考试"
        ? ["整理范围", "复习重点", "错题回看", "模拟自测"]
        : ["理解要求", "完成主体", "检查提交"]
  return stages.map((name, index) => {
    const percent = Math.round(((index + 1) / stages.length) * 100)
    const day = Math.max(1, Math.round((left / stages.length) * (index + 1)))
    return {
      name,
      target: "剩余 " + day + " 天内推进到 " + percent + "%",
      done: Number(task.progress || 0) >= percent
    }
  })
}

function upcomingReminders(task) {
  const due = parseDateTime(task).getTime()
  return (task.remindOffsets || []).map(offset => {
    const date = new Date(due - offset * 60000)
    return {
      offset,
      label: offset >= 1440 ? Math.round(offset / 1440) + " 天前" : offset + " 分钟前",
      time: formatDate(date) + " " + pad(date.getHours()) + ":" + pad(date.getMinutes())
    }
  })
}

module.exports = {
  STORAGE_KEY,
  createTaskFromText,
  daysLeft,
  formatDate,
  getToday,
  levelOf,
  loadTasks,
  normalizeTask,
  saveTasks,
  splitPlan,
  upcomingReminders
}
