const taskUtil = require("../../utils/tasks")

const TEAM_KEY = "ddl_teams_v1"
const ACTIVE_TEAM_KEY = "ddl_active_team_v1"

function defaultTeams() {
  return [
    {
      id: "team-default",
      name: "默认协作组",
      members: [
        { name: "我", avatar: "我" },
        { name: "林同学", avatar: "林" },
        { name: "周同学", avatar: "周" }
      ]
    }
  ]
}

function splitNames(text) {
  return (text || "我").split(/[、,，\s]+/).map(name => name.trim()).filter(Boolean)
}

Page({
  data: {
    teams: [],
    activeTeam: { id: "", name: "", members: [] },
    sharedTasks: [],
    doneCount: 0,
    teamProgress: 0,
    showTeamEditor: false,
    teamEditorMode: "new",
    teamEditorTitle: "新建团队",
    teamDraft: {
      name: "",
      memberText: ""
    },
    showTaskEditor: false,
    taskEditorMode: "new",
    taskEditorTitle: "新建协作任务",
    taskTypeIndex: 0,
    taskEstimateUnits: 8,
    taskEstimateLabel: "4 小时",
    typeOptions: ["作业", "竞赛", "论文", "考试", "展示", "任务"],
    taskDraft: {
      id: "",
      title: "",
      type: "任务",
      dueDate: "",
      dueTime: "23:00",
      estimateHours: 4,
      progress: 0,
      assigneeText: "",
      stepsText: ""
    },
    templates: [
      {
        icon: "文",
        title: "课程论文",
        desc: "文献、提纲、初稿、定稿四阶段",
        task: {
          title: "课程论文",
          type: "论文",
          estimateHours: 18,
          importance: 5,
          shared: true
        }
      },
      {
        icon: "赛",
        title: "竞赛材料",
        desc: "分工、调研、计划书、路演演练",
        task: {
          title: "竞赛材料包",
          type: "竞赛",
          estimateHours: 24,
          importance: 5,
          shared: true
        }
      },
      {
        icon: "展",
        title: "小组展示",
        desc: "收集素材、制作 PPT、彩排",
        task: {
          title: "小组展示",
          type: "展示",
          estimateHours: 5,
          importance: 4,
          shared: true
        }
      },
      {
        icon: "考",
        title: "期末复习",
        desc: "范围整理、错题复盘、模拟自测",
        task: {
          title: "期末复习计划",
          type: "考试",
          estimateHours: 12,
          importance: 5,
          shared: true
        }
      }
    ]
  },

  onShow() {
    this.refresh()
  },

  loadTeams() {
    const teams = wx.getStorageSync(TEAM_KEY)
    if (Array.isArray(teams) && teams.length) return teams
    const initial = defaultTeams()
    wx.setStorageSync(TEAM_KEY, initial)
    return initial
  },

  saveTeams(teams) {
    wx.setStorageSync(TEAM_KEY, teams)
  },

  refresh(teamId) {
    const storedTeams = this.loadTeams()
    const activeId = teamId || wx.getStorageSync(ACTIVE_TEAM_KEY) || storedTeams[0].id
    const activeTeam = storedTeams.find(team => team.id === activeId) || storedTeams[0]
    wx.setStorageSync(ACTIVE_TEAM_KEY, activeTeam.id)
    const teams = storedTeams.map(team => Object.assign({}, team, {
      activeClass: team.id === activeTeam.id ? "active" : ""
    }))
    const sharedTasks = this.buildSharedTasks(activeTeam)
    this.setData({
      teams,
      activeTeam,
      sharedTasks,
      doneCount: sharedTasks.filter(task => task.done).length,
      teamProgress: sharedTasks.length ? Math.round(sharedTasks.reduce((sum, task) => sum + Number(task.progress || 0), 0) / sharedTasks.length) : 0
    })
  },

  buildSharedTasks(activeTeam) {
    return taskUtil.loadTasks()
      .filter(task => task.shared && (!task.teamId || task.teamId === activeTeam.id))
      .map(task => this.prepareTeamTask(task, activeTeam))
      .sort((a, b) => b.level.score - a.level.score || a.left - b.left)
  },

  prepareTeamTask(task, activeTeam) {
    const members = activeTeam.members && activeTeam.members.length ? activeTeam.members : defaultTeams()[0].members
    const assignees = task.assignees && task.assignees.length
      ? task.assignees
      : members.slice(0, Math.min(2, members.length)).map(member => member.name)
    const steps = task.teamSteps && task.teamSteps.length
      ? task.teamSteps
      : taskUtil.splitPlan(task).map((step, index) => ({
        name: step.name,
        owner: members[index % members.length].name,
        done: step.done
      }))
    return Object.assign({}, task, {
      level: taskUtil.levelOf(task),
      left: taskUtil.daysLeft(task),
      assigneeNames: assignees.map(name => name.slice(0, 1)),
      assignees,
      teamSteps: steps.map(step => Object.assign({}, step, {
        doneClass: step.done ? "done" : ""
      }))
    })
  },

  selectTeam(event) {
    this.refresh(event.currentTarget.dataset.id)
  },

  openTeamEditor() {
    this.setData({
      showTeamEditor: true,
      teamEditorMode: "new",
      teamEditorTitle: "新建团队",
      teamDraft: {
        name: "",
        memberText: "我、林同学、周同学"
      }
    })
  },

  openMemberEditor() {
    const team = this.data.activeTeam
    this.setData({
      showTeamEditor: true,
      teamEditorMode: "edit",
      teamEditorTitle: "编辑成员",
      teamDraft: {
        name: team.name,
        memberText: team.members.map(member => member.name).join("、")
      }
    })
  },

  closeTeamEditor() {
    this.setData({ showTeamEditor: false })
  },

  onTeamInput(event) {
    const field = event.currentTarget.dataset.field
    this.setData({
      ["teamDraft." + field]: event.detail.value
    })
  },

  saveTeam() {
    const draft = this.data.teamDraft
    if (!draft.name.trim()) {
      wx.showToast({ title: "请输入团队名称", icon: "none" })
      return
    }
    const members = this.parseMembers(draft.memberText)
    const isEdit = this.data.teamEditorMode === "edit"
    const team = {
      id: isEdit ? this.data.activeTeam.id : "team-" + Date.now(),
      name: draft.name.trim(),
      members
    }
    const teams = isEdit
      ? this.loadTeams().map(item => item.id === team.id ? team : item)
      : this.loadTeams().concat([team])
    this.saveTeams(teams)
    this.setData({ showTeamEditor: false })
    this.refresh(team.id)
    wx.showToast({ title: isEdit ? "成员已更新" : "团队已创建" })
  },

  parseMembers(text) {
    const names = splitNames(text)
    const safeNames = names.length ? names : ["我"]
    return safeNames.map(name => ({
      name,
      avatar: name.slice(0, 1)
    }))
  },

  addMember() {
    const activeTeam = this.data.activeTeam
    const nextIndex = activeTeam.members.length + 1
    const member = { name: "成员" + nextIndex, avatar: String(nextIndex) }
    const teams = this.loadTeams().map(team => {
      if (team.id !== activeTeam.id) return team
      return Object.assign({}, team, {
        members: team.members.concat([member])
      })
    })
    this.saveTeams(teams)
    this.refresh(activeTeam.id)
  },

  copyInvite() {
    const team = this.data.activeTeam
    wx.setClipboardData({
      data: "邀请你加入「" + team.name + "」DDL 协作看板，共享任务、分工和阶段进度。",
      success() {
        wx.showToast({ title: "邀请语已复制" })
      }
    })
  },

  openNewSharedTask() {
    const team = this.data.activeTeam
    const date = new Date()
    date.setDate(date.getDate() + 7)
    this.setData({
      showTaskEditor: true,
      taskEditorMode: "new",
      taskEditorTitle: "新建协作任务",
      taskTypeIndex: 5,
      taskEstimateUnits: 8,
      taskEstimateLabel: this.formatEstimate(4),
      taskDraft: {
        id: "",
        title: "",
        type: "任务",
        dueDate: taskUtil.formatDate(date),
        dueTime: "23:00",
        estimateHours: 4,
        progress: 0,
        assigneeText: team.members.map(member => member.name).join("、"),
        stepsText: "明确要求｜我｜未完成\n完成主体｜" + (team.members[1] ? team.members[1].name : "我") + "｜未完成\n检查提交｜" + (team.members[2] ? team.members[2].name : "我") + "｜未完成"
      }
    })
  },

  openSharedTaskEditor(event) {
    const taskId = event.currentTarget.dataset.id
    const task = this.data.sharedTasks.find(item => item.id === taskId)
    if (!task) return
    const stepsText = task.teamSteps.map(step => step.name + "｜" + step.owner + "｜" + (step.done ? "已完成" : "未完成")).join("\n")
    const taskTypeIndex = Math.max(0, this.data.typeOptions.indexOf(task.type))
    const taskEstimateUnits = Math.max(1, Math.round(Number(task.estimateHours || 4) * 2))
    this.setData({
      showTaskEditor: true,
      taskEditorMode: "edit",
      taskEditorTitle: "编辑协作任务",
      taskTypeIndex,
      taskEstimateUnits,
      taskEstimateLabel: this.formatEstimate(taskEstimateUnits / 2),
      taskDraft: {
        id: task.id,
        title: task.title,
        type: task.type,
        dueDate: task.dueDate,
        dueTime: task.dueTime,
        estimateHours: task.estimateHours,
        progress: task.progress,
        assigneeText: task.assignees.join("、"),
        stepsText
      }
    })
  },

  closeTaskEditor() {
    this.setData({ showTaskEditor: false })
  },

  onTaskInput(event) {
    const field = event.currentTarget.dataset.field
    this.setData({
      ["taskDraft." + field]: event.detail.value
    })
  },

  onTaskTypeChange(event) {
    const index = Number(event.detail.value)
    this.setData({
      taskTypeIndex: index,
      "taskDraft.type": this.data.typeOptions[index]
    })
  },

  onTaskDateChange(event) {
    this.setData({ "taskDraft.dueDate": event.detail.value })
  },

  onTaskTimeChange(event) {
    this.setData({ "taskDraft.dueTime": event.detail.value })
  },

  onTaskHoursChange(event) {
    const units = Number(event.detail.value)
    const hours = units / 2
    this.setData({
      taskEstimateUnits: units,
      taskEstimateLabel: this.formatEstimate(hours),
      "taskDraft.estimateHours": hours
    })
  },

  onTaskProgressChange(event) {
    const progress = Number(event.detail.value)
    this.setData({ "taskDraft.progress": progress })
  },

  formatEstimate(hours) {
    if (hours < 1) return "30 分钟"
    if (hours % 1 === 0) return hours + " 小时"
    return Math.floor(hours) + " 小时 30 分钟"
  },

  saveSharedTask() {
    const draft = this.data.taskDraft
    const team = this.data.activeTeam
    if (!draft.title.trim()) {
      wx.showToast({ title: "请输入任务名称", icon: "none" })
      return
    }
    const assignees = this.parseMemberNames(draft.assigneeText)
    const teamSteps = this.parseSteps(draft.stepsText, assignees)
    const progress = teamSteps.length
      ? Math.round(teamSteps.filter(step => step.done).length / teamSteps.length * 100)
      : Number(draft.progress || 0)
    const taskSource = {
      title: draft.title.trim(),
      course: team.name,
      type: draft.type,
      dueDate: draft.dueDate,
      dueTime: draft.dueTime,
      estimateHours: Number(draft.estimateHours || 4),
      importance: 4,
      progress,
      done: progress >= 100,
      shared: true,
      teamId: team.id,
      assignees,
      teamSteps,
      remindOffsets: [2880, 360, 30]
    }
    if (draft.id) taskSource.id = draft.id
    const baseTask = taskUtil.normalizeTask(taskSource)
    const existing = taskUtil.loadTasks()
    const tasks = this.data.taskEditorMode === "new"
      ? [baseTask].concat(existing)
      : existing.map(task => task.id === baseTask.id ? Object.assign({}, task, baseTask, { createdAt: task.createdAt }) : task)
    taskUtil.saveTasks(tasks)
    this.setData({ showTaskEditor: false })
    this.refresh(team.id)
    wx.showToast({ title: "协作已保存" })
  },

  parseMemberNames(text) {
    const names = splitNames(text)
    return names.length ? names : ["我"]
  },

  parseSteps(text, assignees) {
    return (text || "").split(/\n+/).map((line, index) => {
      const parts = line.split(/[|｜]/).map(item => item.trim())
      if (!parts[0]) return null
      const owner = parts[1] || assignees[index % assignees.length] || "我"
      const state = parts[2] || ""
      const isDone = /未完成|待完成|待推进/.test(state) ? false : /已完成|完成了|done|100/i.test(state)
      return {
        name: parts[0],
        owner,
        done: isDone
      }
    }).filter(Boolean)
  },

  toggleStep(event) {
    const taskId = event.currentTarget.dataset.taskId
    const index = Number(event.currentTarget.dataset.index)
    const team = this.data.activeTeam
    const tasks = taskUtil.loadTasks().map(task => {
      if (task.id !== taskId) return task
      const prepared = this.prepareTeamTask(task, team)
      const teamSteps = prepared.teamSteps.map((step, stepIndex) => {
        if (stepIndex !== index) return {
          name: step.name,
          owner: step.owner,
          done: step.done
        }
        return {
          name: step.name,
          owner: step.owner,
          done: !step.done
        }
      })
      const doneSteps = teamSteps.filter(step => step.done).length
      return Object.assign({}, task, {
        shared: true,
        teamId: team.id,
        teamSteps,
        progress: Math.round(doneSteps / teamSteps.length * 100),
        done: doneSteps === teamSteps.length
      })
    })
    taskUtil.saveTasks(tasks)
    this.refresh(team.id)
  },

  copyTaskBrief(event) {
    const taskId = event.currentTarget.dataset.id
    const task = this.data.sharedTasks.find(item => item.id === taskId)
    if (!task) return
    const steps = task.teamSteps.map(step => (step.done ? "已完成 " : "待推进 ") + step.name + "：" + step.owner).join("\n")
    wx.setClipboardData({
      data: "任务：" + task.title + "\n截止：" + task.dueDate + " " + task.dueTime + "\n进度：" + task.progress + "%\n" + steps,
      success() {
        wx.showToast({ title: "摘要已复制" })
      }
    })
  },

  removeFromTeam(event) {
    const taskId = event.currentTarget.dataset.id
    const team = this.data.activeTeam
    const tasks = taskUtil.loadTasks().map(task => {
      if (task.id !== taskId) return task
      return Object.assign({}, task, {
        shared: false,
        teamId: "",
        assignees: [],
        teamSteps: []
      })
    })
    taskUtil.saveTasks(tasks)
    this.refresh(team.id)
    wx.showToast({ title: "已移出协作" })
  },

  useTemplate(event) {
    const template = this.data.templates[event.currentTarget.dataset.index]
    const team = this.data.activeTeam
    const date = new Date()
    date.setDate(date.getDate() + (template.task.type === "竞赛" ? 14 : 7))
    const dueDate = taskUtil.formatDate(date)
    const task = taskUtil.normalizeTask(Object.assign({}, template.task, {
      dueDate,
      dueTime: "23:00",
      progress: 0
    }))
    const members = team.members && team.members.length ? team.members : defaultTeams()[0].members
    const steps = taskUtil.splitPlan(task).map((step, index) => step.name + "｜" + members[index % members.length].name + "｜未完成").join("\n")
    const taskTypeIndex = Math.max(0, this.data.typeOptions.indexOf(task.type))
    const taskEstimateUnits = Math.max(1, Math.round(Number(task.estimateHours || 4) * 2))
    this.setData({
      showTaskEditor: true,
      taskEditorMode: "new",
      taskEditorTitle: "编辑模板：" + template.title,
      taskTypeIndex,
      taskEstimateUnits,
      taskEstimateLabel: this.formatEstimate(taskEstimateUnits / 2),
      taskDraft: {
        id: "",
        title: task.title,
        type: task.type,
        dueDate,
        dueTime: "23:00",
        estimateHours: task.estimateHours,
        progress: 0,
        assigneeText: members.slice(0, Math.min(3, members.length)).map(member => member.name).join("、"),
        stepsText: steps
      }
    })
  }
})
