const taskUtil = require("../../utils/tasks")

Page({
  data: {
    weeks: ["一", "二", "三", "四", "五", "六", "日"],
    monthTitle: "",
    days: [],
    selectedDate: "",
    selectedTasks: []
  },

  onShow() {
    const today = taskUtil.getToday()
    this.buildCalendar(today)
  },

  buildCalendar(selectedDate) {
    const selected = selectedDate ? new Date(selectedDate + "T00:00:00") : new Date()
    const year = selected.getFullYear()
    const month = selected.getMonth()
    const first = new Date(year, month, 1)
    const startOffset = (first.getDay() + 6) % 7
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const tasks = taskUtil.loadTasks()
    const days = []
    for (let i = 0; i < startOffset; i += 1) {
      days.push({ date: "blank-" + i, day: "", count: 0 })
    }
    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = year + "-" + this.pad(month + 1) + "-" + this.pad(day)
      const count = tasks.filter(task => task.dueDate === date && !task.done).length
      days.push({
        date,
        day,
        count,
        todayClass: date === taskUtil.getToday() ? "today" : "",
        loadClass: this.loadClass(count)
      })
    }
    this.setData({
      monthTitle: year + " 年 " + this.pad(month + 1) + " 月",
      days,
      selectedDate,
      selectedTasks: this.tasksForDate(selectedDate, tasks)
    })
  },

  tasksForDate(date, sourceTasks) {
    return sourceTasks
      .filter(task => task.dueDate === date)
      .map(task => Object.assign({}, task, { level: taskUtil.levelOf(task) }))
      .sort((a, b) => b.level.score - a.level.score)
  },

  selectDate(event) {
    const date = event.currentTarget.dataset.date
    if (!date || date.indexOf("blank") === 0) return
    this.setData({
      selectedDate: date,
      selectedTasks: this.tasksForDate(date, taskUtil.loadTasks())
    })
  },

  pad(num) {
    return num < 10 ? "0" + num : "" + num
  },

  loadClass(count) {
    if (count >= 3) return "load-high"
    if (count >= 2) return "load-mid"
    if (count >= 1) return "load-low"
    return ""
  }
})
