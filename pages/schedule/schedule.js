const SCHEDULE_KEY = "ddl_schedule_v1"

const days = [
  { key: "mon", name: "周一" },
  { key: "tue", name: "周二" },
  { key: "wed", name: "周三" },
  { key: "thu", name: "周四" },
  { key: "fri", name: "周五" },
  { key: "sat", name: "周六" },
  { key: "sun", name: "周日" }
]

const periods = [
  { index: 1, time: "08:00-08:50" },
  { index: 2, time: "09:00-09:50" },
  { index: 3, time: "10:10-11:00" },
  { index: 4, time: "11:10-12:00" },
  { index: 5, time: "14:00-14:50" },
  { index: 6, time: "15:00-15:50" },
  { index: 7, time: "16:10-17:00" },
  { index: 8, time: "17:10-18:00" },
  { index: 9, time: "18:30-19:20" },
  { index: 10, time: "19:30-20:20" },
  { index: 11, time: "20:30-21:20" },
  { index: 12, time: "21:30-22:20" }
]

function emptySchedule() {
  const map = {}
  days.forEach(day => {
    map[day.key] = {}
    periods.forEach(period => {
      map[day.key][period.index] = {
        name: "",
        room: "",
        teacher: "",
        note: "",
        filledClass: ""
      }
    })
  })
  return map
}

function hydrateSchedule(source) {
  const map = emptySchedule()
  if (!source || typeof source !== "object") return map
  days.forEach(day => {
    periods.forEach(period => {
      const saved = source[day.key] && source[day.key][period.index]
      if (!saved) return
      map[day.key][period.index] = Object.assign({}, map[day.key][period.index], saved, {
        filledClass: saved.name ? "filled" : ""
      })
    })
  })
  return map
}

function buildRows(scheduleMap) {
  return periods.map(period => ({
    key: "period-" + period.index,
    period,
    cells: days.map(day => Object.assign({
      day: day.key,
      period: period.index
    }, scheduleMap[day.key][period.index]))
  }))
}

Page({
  data: {
    days,
    periods,
    scheduleMap: emptySchedule(),
    scheduleRows: buildRows(emptySchedule()),
    todayCourses: [],
    showEditor: false,
    editorTitle: "录入课程",
    activeDay: "",
    activePeriod: 0,
    courseDraft: {
      name: "",
      room: "",
      teacher: "",
      note: ""
    }
  },

  onShow() {
    this.refresh()
  },

  loadSchedule() {
    return hydrateSchedule(wx.getStorageSync(SCHEDULE_KEY))
  },

  saveSchedule(scheduleMap) {
    wx.setStorageSync(SCHEDULE_KEY, scheduleMap)
  },

  refresh() {
    const scheduleMap = this.loadSchedule()
    this.setData({
      scheduleMap,
      scheduleRows: buildRows(scheduleMap),
      todayCourses: this.getTodayCourses(scheduleMap)
    })
  },

  getTodayCourses(scheduleMap) {
    const dayIndex = new Date().getDay()
    const key = days[(dayIndex + 6) % 7].key
    return periods
      .map(period => Object.assign({ period: period.index, time: period.time }, scheduleMap[key][period.index]))
      .filter(course => course.name)
  },

  openCourseEditor(event) {
    const day = event.currentTarget.dataset.day
    const period = Number(event.currentTarget.dataset.period)
    const course = this.data.scheduleMap[day][period]
    const dayName = days.find(item => item.key === day).name
    this.setData({
      showEditor: true,
      editorTitle: dayName + " 第 " + period + " 节",
      activeDay: day,
      activePeriod: period,
      courseDraft: {
        name: course.name || "",
        room: course.room || "",
        teacher: course.teacher || "",
        note: course.note || ""
      }
    })
  },

  closeEditor() {
    this.setData({ showEditor: false })
  },

  onCourseInput(event) {
    const field = event.currentTarget.dataset.field
    this.setData({
      ["courseDraft." + field]: event.detail.value
    })
  },

  saveCourse() {
    const draft = this.data.courseDraft
    if (!draft.name.trim()) {
      wx.showToast({ title: "请输入课程名称", icon: "none" })
      return
    }
    const scheduleMap = this.data.scheduleMap
    const day = this.data.activeDay
    const period = this.data.activePeriod
    scheduleMap[day][period] = {
      name: draft.name.trim(),
      room: (draft.room || "").trim(),
      teacher: (draft.teacher || "").trim(),
      note: (draft.note || "").trim(),
      filledClass: "filled"
    }
    this.saveSchedule(scheduleMap)
    this.setData({
      showEditor: false,
      scheduleMap,
      scheduleRows: buildRows(scheduleMap),
      todayCourses: this.getTodayCourses(scheduleMap)
    })
    wx.showToast({ title: "课程已保存" })
  },

  deleteCourse() {
    const scheduleMap = this.data.scheduleMap
    const day = this.data.activeDay
    const period = this.data.activePeriod
    scheduleMap[day][period] = {
      name: "",
      room: "",
      teacher: "",
      note: "",
      filledClass: ""
    }
    this.saveSchedule(scheduleMap)
    this.setData({
      showEditor: false,
      scheduleMap,
      scheduleRows: buildRows(scheduleMap),
      todayCourses: this.getTodayCourses(scheduleMap)
    })
    wx.showToast({ title: "已删除" })
  },

  clearSchedule() {
    wx.showModal({
      title: "清空课表",
      content: "确定清空全部手动录入的课程吗？",
      confirmText: "清空",
      confirmColor: "#a83d2b",
      success: result => {
        if (!result.confirm) return
        const scheduleMap = emptySchedule()
        this.saveSchedule(scheduleMap)
        this.setData({
          scheduleMap,
          scheduleRows: buildRows(scheduleMap),
          todayCourses: []
        })
      }
    })
  },

  fillExample() {
    const scheduleMap = this.loadSchedule()
    scheduleMap.mon[1] = { name: "高等数学", room: "A203", teacher: "王老师", note: "", filledClass: "filled" }
    scheduleMap.wed[3] = { name: "大学英语", room: "B108", teacher: "李老师", note: "带听力材料", filledClass: "filled" }
    scheduleMap.fri[5] = { name: "专业导论", room: "C301", teacher: "陈老师", note: "", filledClass: "filled" }
    this.saveSchedule(scheduleMap)
    this.setData({
      scheduleMap,
      scheduleRows: buildRows(scheduleMap),
      todayCourses: this.getTodayCourses(scheduleMap)
    })
    wx.showToast({ title: "示例已填充" })
  },

  exportText() {
    const scheduleMap = this.data.scheduleMap
    const lines = []
    days.forEach(day => {
      periods.forEach(period => {
        const course = scheduleMap[day.key][period.index]
        if (!course.name) return
        lines.push(day.name + " 第 " + period.index + " 节 " + period.time + " " + course.name + " " + (course.room || "") + " " + (course.teacher || ""))
      })
    })
    wx.setClipboardData({
      data: lines.length ? lines.join("\n") : "暂无课程",
      success() {
        wx.showToast({ title: "课表已复制" })
      }
    })
  },

  goBack() {
    wx.navigateBack({
      fail() {
        wx.switchTab({ url: "/pages/index/index" })
      }
    })
  }
})
