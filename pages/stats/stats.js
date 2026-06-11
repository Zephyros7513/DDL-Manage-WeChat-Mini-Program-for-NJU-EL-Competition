const taskUtil = require("../../utils/tasks")

Page({
  data: {
    stats: {
      finishRate: 0,
      open: 0,
      urgent: 0,
      overdue: 0,
      pressure: 0,
      longTaskRate: 0,
      teamProgress: 0
    },
    typeBars: [],
    weekLoads: [],
    suggestions: []
  },

  onShow() {
    const tasks = taskUtil.loadTasks()
    const done = tasks.filter(task => task.done).length
    const open = tasks.length - done
    const urgent = tasks.filter(task => !task.done && taskUtil.levelOf(task).key === "urgent").length
    const overdue = tasks.filter(task => !task.done && taskUtil.daysLeft(task) < 0).length
    const sharedTasks = tasks.filter(task => task.shared)
    const longTasks = tasks.filter(task => Number(task.estimateHours || 0) >= 8)
    const splitLongTasks = longTasks.filter(task => (task.teamSteps && task.teamSteps.length) || Number(task.progress || 0) > 0)
    const byType = {}
    tasks.forEach(task => {
      byType[task.type] = (byType[task.type] || 0) + 1
    })
    const max = Math.max.apply(null, Object.keys(byType).map(type => byType[type]).concat([1]))
    const colors = ["#146b63", "#f2bf4e", "#d96b52", "#4779a8", "#8a6fba"]
    const typeBars = Object.keys(byType).map((type, index) => ({
      type,
      count: byType[type],
      percent: Math.max(8, Math.round(byType[type] / max * 100)),
      color: colors[index % colors.length]
    }))
    this.setData({
      stats: {
        finishRate: tasks.length ? Math.round(done / tasks.length * 100) : 0,
        open,
        urgent,
        overdue,
        pressure: this.calcPressure(tasks),
        longTaskRate: longTasks.length ? Math.round(splitLongTasks.length / longTasks.length * 100) : 0,
        teamProgress: sharedTasks.length ? Math.round(sharedTasks.reduce((sum, task) => sum + Number(task.progress || 0), 0) / sharedTasks.length) : 0
      },
      typeBars,
      weekLoads: this.buildWeekLoads(tasks),
      suggestions: this.buildSuggestions(tasks, urgent)
    })
  },

  calcPressure(tasks) {
    const openTasks = tasks.filter(task => !task.done)
    if (!openTasks.length) return 0
    const score = openTasks.reduce((sum, task) => {
      const left = taskUtil.daysLeft(task)
      const urgentWeight = left < 0 ? 18 : left <= 1 ? 14 : left <= 3 ? 10 : left <= 7 ? 6 : 3
      return sum + urgentWeight + Number(task.importance || 3) * 2
    }, 0)
    return Math.min(99, Math.round(score / openTasks.length + openTasks.length * 4))
  },

  buildWeekLoads(tasks) {
    const labels = ["今天", "明天", "后天", "第4天", "第5天", "第6天", "第7天"]
    const loads = []
    for (let index = 0; index < 7; index += 1) {
      const date = new Date()
      date.setDate(date.getDate() + index)
      const dateText = taskUtil.formatDate(date)
      const count = tasks.filter(task => !task.done && task.dueDate === dateText).length
      loads.push({
        date: dateText,
        label: labels[index],
        count,
        height: Math.max(8, Math.min(100, count * 28)),
        levelClass: count >= 3 ? "heavy" : count >= 2 ? "medium" : ""
      })
    }
    return loads
  },

  buildSuggestions(tasks, urgent) {
    const longTasks = tasks.filter(task => !task.done && Number(task.estimateHours) >= 8)
    const soonTasks = tasks.filter(task => !task.done && taskUtil.daysLeft(task) <= 3)
    const overdue = tasks.filter(task => !task.done && taskUtil.daysLeft(task) < 0)
    const sharedTasks = tasks.filter(task => task.shared && !task.done)
    const suggestions = []
    if (overdue.length) {
      suggestions.push({
        title: "处理逾期任务",
        body: "有 " + overdue.length + " 项任务已经超过截止时间，建议先重新确认提交状态或调整截止日期。"
      })
    }
    if (urgent) {
      suggestions.push({
        title: "先处理高压 DDL",
        body: "今天优先清理红色任务，把提醒时间前移到提交前 3 小时和 30 分钟。"
      })
    }
    if (longTasks.length) {
      suggestions.push({
        title: "给长期任务切阶段",
        body: "论文、竞赛类任务建议每天固定 45 分钟推进，避免最后两天集中爆发。"
      })
    }
    if (sharedTasks.length) {
      suggestions.push({
        title: "同步团队进度",
        body: "协作任务可以在团队页按阶段勾选完成情况，并复制摘要给组员。"
      })
    }
    if (soonTasks.length >= 2) {
      suggestions.push({
        title: "本周 DDL 偏拥挤",
        body: "日历中同一天多项任务时，先完成预计耗时短的任务，释放注意力。"
      })
    }
    if (!suggestions.length) {
      suggestions.push({
        title: "节奏不错",
        body: "目前任务压力稳定，可以提前推进下周的高重要度任务。"
      })
    }
    return suggestions
  }
})
