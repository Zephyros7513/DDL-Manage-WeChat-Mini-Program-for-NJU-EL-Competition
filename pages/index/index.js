const taskUtil = require("../../utils/tasks")

Page({
  data: {
    tasks: [],
    activeTask: null,
    activePlan: [],
    activeReminders: [],
    showEditor: false,
    editDraft: null,
    editorMode: "edit",
    editorTitle: "编辑任务",
    editTypeIndex: 0,
    editEstimateUnits: 4,
    editEstimateLabel: "2 小时",
    typeOptions: ["作业", "竞赛", "论文", "考试", "展示", "任务"],
    reminderOptions: [
      { label: "7 天前", value: "10080", checked: false },
      { label: "2 天前", value: "2880", checked: false },
      { label: "1 天前", value: "1440", checked: false },
      { label: "3 小时前", value: "180", checked: false },
      { label: "30 分钟前", value: "30", checked: false }
    ],
    summary: {
      open: 0,
      highest: "稳定",
      pressure: 0
    },
    todayLabel: ""
  },

  onShow() {
    this.refresh()
  },

  refresh(activeId) {
    const rawTasks = taskUtil.loadTasks()
    const tasks = rawTasks
      .map(task => Object.assign({}, task, {
        left: taskUtil.daysLeft(task),
        level: taskUtil.levelOf(task),
        doneClass: task.done ? "task-done" : "",
        hotClass: taskUtil.daysLeft(task) <= 1 ? "hot" : ""
      }))
      .sort((a, b) => b.level.score - a.level.score || a.left - b.left)
    const activeTask = tasks.find(task => task.id === activeId) || tasks[0] || null
    this.setData({
      tasks,
      activeTask,
      activePlan: activeTask ? taskUtil.splitPlan(activeTask).map(step => Object.assign({}, step, {
        doneClass: step.done ? "step-done" : ""
      })) : [],
      activeReminders: activeTask ? taskUtil.upcomingReminders(activeTask) : [],
      summary: this.buildSummary(tasks),
      todayLabel: taskUtil.getToday()
    })
  },

  buildSummary(tasks) {
    const openTasks = tasks.filter(task => !task.done)
    const maxScore = openTasks.reduce((max, task) => Math.max(max, task.level.score), 0)
    const urgent = openTasks.find(task => task.level.key === "urgent")
    return {
      open: openTasks.length,
      highest: urgent ? "爆表" : maxScore >= 7 ? "偏高" : "稳定",
      pressure: Math.min(99, maxScore * 10 + openTasks.length * 3)
    }
  },

  openNewTaskEditor() {
    const draft = taskUtil.normalizeTask({
      title: "",
      course: "",
      type: "作业",
      dueDate: taskUtil.getToday(),
      dueTime: "23:59",
      importance: 3,
      estimateHours: 2,
      progress: 0,
      done: false,
      shared: false,
      remindOffsets: [1440, 180]
    })
    this.setEditorState(draft, "new")
  },

  openSchedule() {
    wx.navigateTo({ url: "/pages/schedule/schedule" })
  },

  selectTask(event) {
    this.refresh(event.currentTarget.dataset.id)
  },

  toggleDone(event) {
    const active = this.data.activeTask
    if (!active) return
    const tasks = taskUtil.loadTasks().map(task => {
      if (task.id !== active.id) return task
      return Object.assign({}, task, {
        done: event.detail.value,
        progress: event.detail.value ? 100 : task.progress
      })
    })
    taskUtil.saveTasks(tasks)
    this.refresh(active.id)
  },

  changeProgress(event) {
    const active = this.data.activeTask
    if (!active) return
    const progress = event.detail.value
    const tasks = taskUtil.loadTasks().map(task => {
      if (task.id !== active.id) return task
      return Object.assign({}, task, {
        progress,
        done: progress >= 100
      })
    })
    taskUtil.saveTasks(tasks)
    this.refresh(active.id)
  },

  openEditor() {
    if (!this.data.activeTask) return
    this.setEditorState(this.data.activeTask, "edit")
  },

  openEditorById(event) {
    const id = event.currentTarget.dataset.id
    const task = taskUtil.loadTasks().find(item => item.id === id)
    if (!task) return
    this.refresh(id)
    this.setEditorState(task, "edit")
  },

  setEditorState(sourceTask, mode) {
    const draft = Object.assign({}, sourceTask, {
      remindOffsets: (sourceTask.remindOffsets || []).slice()
    })
    const editTypeIndex = Math.max(0, this.data.typeOptions.indexOf(draft.type))
    const editEstimateUnits = Math.max(1, Math.round(Number(draft.estimateHours || 1) * 2))
    this.setData({
      showEditor: true,
      editDraft: draft,
      editorMode: mode,
      editorTitle: mode === "new" ? "新建任务" : "编辑任务",
      editTypeIndex,
      editEstimateUnits,
      editEstimateLabel: this.formatEstimate(editEstimateUnits / 2),
      reminderOptions: this.buildReminderOptions(draft.remindOffsets)
    })
  },

  formatEstimate(hours) {
    if (hours < 1) return "30 分钟"
    if (hours % 1 === 0) return hours + " 小时"
    return Math.floor(hours) + " 小时 30 分钟"
  },

  buildReminderOptions(offsets) {
    const selected = (offsets || []).map(item => String(item))
    return this.data.reminderOptions.map(option => Object.assign({}, option, {
      checked: selected.indexOf(option.value) >= 0
    }))
  },

  closeEditor() {
    this.setData({
      showEditor: false,
      editDraft: null,
      editorMode: "edit"
    })
  },

  onEditInput(event) {
    const field = event.currentTarget.dataset.field
    this.setData({
      ["editDraft." + field]: event.detail.value
    })
  },

  onEditTypeChange(event) {
    const index = Number(event.detail.value)
    this.setData({
      editTypeIndex: index,
      "editDraft.type": this.data.typeOptions[index]
    })
  },

  onEditDateChange(event) {
    this.setData({ "editDraft.dueDate": event.detail.value })
  },

  onEditTimeChange(event) {
    this.setData({ "editDraft.dueTime": event.detail.value })
  },

  onEditImportanceChange(event) {
    this.setData({ "editDraft.importance": Number(event.detail.value) })
  },

  onEditHoursChange(event) {
    const units = Number(event.detail.value)
    const hours = units / 2
    this.setData({
      editEstimateUnits: units,
      editEstimateLabel: this.formatEstimate(hours),
      "editDraft.estimateHours": hours
    })
  },

  onEditProgressChange(event) {
    const progress = Number(event.detail.value)
    this.setData({
      "editDraft.progress": progress,
      "editDraft.done": progress >= 100
    })
  },

  onEditDoneChange(event) {
    this.setData({
      "editDraft.done": event.detail.value,
      "editDraft.progress": event.detail.value ? 100 : this.data.editDraft.progress
    })
  },

  onEditSharedChange(event) {
    this.setData({ "editDraft.shared": event.detail.value })
  },

  onReminderChange(event) {
    const remindOffsets = event.detail.value.map(item => Number(item)).sort((a, b) => b - a)
    this.setData({
      "editDraft.remindOffsets": remindOffsets,
      reminderOptions: this.buildReminderOptions(remindOffsets)
    })
  },

  saveEditor() {
    const draft = this.data.editDraft
    if (!draft.title || !draft.title.trim()) {
      wx.showToast({ title: "任务名称不能为空", icon: "none" })
      return
    }
    const isNew = this.data.editorMode === "new"
    const updated = {
      id: draft.id,
      title: draft.title.trim(),
      course: (draft.course || "").trim(),
      type: draft.type,
      dueDate: draft.dueDate,
      dueTime: draft.dueTime,
      importance: Number(draft.importance || 3),
      estimateHours: Number(draft.estimateHours || 1),
      progress: Number(draft.progress || 0),
      done: draft.done || Number(draft.progress || 0) >= 100,
      shared: !!draft.shared,
      remindOffsets: (draft.remindOffsets || []).slice(),
      createdAt: draft.createdAt || new Date().toISOString()
    }
    const existing = taskUtil.loadTasks()
    const tasks = isNew
      ? [updated].concat(existing)
      : existing.map(task => task.id === updated.id ? updated : task)
    taskUtil.saveTasks(tasks)
    this.setData({
      showEditor: false,
      editDraft: null,
      editorMode: "edit"
    })
    this.refresh(updated.id)
    wx.showToast({ title: isNew ? "已新建" : "已保存" })
  },

  deleteActiveTask() {
    const active = this.data.activeTask
    if (!active) return
    this.confirmDeleteTask(active)
  },

  deleteTaskById(event) {
    const id = event.currentTarget.dataset.id
    const task = taskUtil.loadTasks().find(item => item.id === id)
    if (!task) return
    this.confirmDeleteTask(task)
  },

  confirmDeleteTask(active) {
    wx.showModal({
      title: "删除任务",
      content: "确定删除「" + active.title + "」吗？删除后不可恢复。",
      confirmText: "删除",
      confirmColor: "#a83d2b",
      success: result => {
        if (!result.confirm) return
        const tasks = taskUtil.loadTasks().filter(task => task.id !== active.id)
        taskUtil.saveTasks(tasks)
        this.setData({
          showEditor: false,
          editDraft: null
        })
        this.refresh()
        wx.showToast({ title: "已删除" })
      }
    })
  }
})
