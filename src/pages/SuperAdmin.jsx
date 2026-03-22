import React, { useState, useEffect } from 'react'
import cloudbase from '../utils/cloudbase'

// 项目类型映射（数字代码 -> 显示名称）
const PROJECT_MAP = {
  '中管局': '中管局',
  '卫生厅': '卫生厅',
  '省自然': '省自然',
  '国青': '国青',
  '面上': '面上',
  '其他': '其他',
}

// 进度状态样式（DaisyUI badge）
const PROGRESS_BADGE = {
  已交付: 'badge-success',
  进展中: 'badge-info',
  未开展: 'badge-ghost',
}

const PAGE_SIZE = 10

const PROJECT_OPTIONS = ['中管局', '卫生厅', '省自然', '国青', '面上', '其他']
// 进度选项：仅教授端可编辑，SuperAdmin 只读
const STATUS_OPTIONS = ['未开展', '进展中', '已交付']
const FEE_TYPE_OPTIONS = ['自费', '经费']

const SuperAdmin = () => {
  const [data, setData] = useState([])
  const [professors, setProfessors] = useState([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState({ show: false, type: '', msg: '' })
  const [page, setPage] = useState(1)
  const [fileLoading, setFileLoading] = useState(null) // 正在获取的文件 ID
  const [editingRecord, setEditingRecord] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [uploading, setUploading] = useState(false)
  const [assigningRecord, setAssigningRecord] = useState(null) // 正在分配的单子
  const [assignProfessorId, setAssignProfessorId] = useState('')
  const [showAddProfessor, setShowAddProfessor] = useState(false)
  const [newProfessor, setNewProfessor] = useState({ name: '', phone: '' })
  const fileInputRef = React.useRef(null)

  const fetchProfessors = async () => {
    try {
      const db = cloudbase.app.database()
      const res = await db.collection('professors').get()
      setProfessors(res.data || [])
    } catch (err) {
      console.error('获取教授列表失败', err)
    }
  }

  const fetchData = async () => {
    setLoading(true)
    try {
      const db = cloudbase.app.database()
      const res = await db.collection('project_manage').get()
      setData(res.data || [])
    } catch (error) {
      console.error('获取数据失败', error)
      showToast('error', '加载数据失败，请检查网络或云开发配置')
      setData([])
    } finally {
      setLoading(false)
    }
  }

  const showToast = (type, msg) => {
    setToast({ show: true, type, msg })
    setTimeout(() => setToast({ show: false, type: '', msg: '' }), 2000)
  }

  useEffect(() => {
    fetchData()
    fetchProfessors()
  }, [])

  const handleAssign = (record) => {
    setAssigningRecord(record)
    setAssignProfessorId(record?.assignedTo || '')
  }

  const handleConfirmAssign = async () => {
    if (!assigningRecord || !assignProfessorId) return
    try {
      const db = cloudbase.app.database()
      await db.collection('project_manage').doc(assigningRecord._id).update({
        assignedTo: assignProfessorId,
        updateTime: new Date(),
      })
      showToast('success', '分配成功')
      setAssigningRecord(null)
      setAssignProfessorId('')
      fetchData()
    } catch (err) {
      console.error('分配失败', err)
      showToast('error', '分配失败')
    }
  }

  const getProfessorName = (professorId) => {
    if (!professorId) return '-'
    const p = professors.find((x) => x._id === professorId)
    return p ? p.name : professorId
  }

  const handleAddProfessor = async () => {
    const phoneDigits = String(newProfessor.phone || '').replace(/\D/g, '')
    if (!newProfessor.name?.trim() || phoneDigits.length !== 11) {
      showToast('error', '请填写姓名和 11 位手机号')
      return
    }
    try {
      const db = cloudbase.app.database()
      await db.collection('professors').add({
        name: newProfessor.name.trim(),
        phone: phoneDigits,
      })
      showToast('success', '添加成功')
      setNewProfessor({ name: '', phone: '' })
      setShowAddProfessor(false)
      fetchProfessors()
    } catch (err) {
      console.error('添加失败', err)
      showToast('error', '添加失败')
    }
  }

  // 获取云存储文件的临时访问链接（Web 端对应 wx.cloud.downloadFile / getTempFileURL）
  const handleViewFile = async (file) => {
    const fileID = file.url || file.fileID
    if (!fileID) return
    if (fileID.startsWith('http')) {
      window.open(fileID, '_blank')
      return
    }
    if (!fileID.startsWith('cloud://')) return

    setFileLoading(fileID)
    try {
      const res = await cloudbase.app.getTempFileURL({
        fileList: [fileID],
      })
      const list = res?.fileList ?? res?.data?.download_list ?? []
      const item = list[0]
      const fileUrl = item?.tempFileURL || item?.download_url

      if (!fileUrl) {
        if (item?.code === 'STORAGE_EXCEED_AUTHORITY') {
          showToast(
            'error',
            '无权限访问：请在云存储控制台将文件设为「公有读」，或使用上传者账号登录'
          )
        } else {
          showToast('error', '获取文件链接失败')
        }
        return
      }

      // 通过 fetch 获取文件内容并创建 Blob URL，避免直接打开 TCB 链接导致的 ERR_INVALID_RESPONSE
      try {
        const resp = await fetch(fileUrl, { mode: 'cors' })
        if (!resp.ok) throw new Error(resp.statusText)
        const blob = await resp.blob()
        const blobUrl = URL.createObjectURL(blob)
        window.open(blobUrl, '_blank')
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60000) // 1 分钟后释放
      } catch (fetchErr) {
        // fetch 失败时回退到直接打开（可能因 CORS 失败）
        console.warn('fetch 文件失败，尝试直接打开链接', fetchErr)
        window.open(fileUrl, '_blank')
      }
    } catch (err) {
      console.error('getTempFileURL 失败', err)
      showToast('error', '获取文件链接失败')
    } finally {
      setFileLoading(null)
    }
  }

  const handleEdit = (record) => {
    setEditingRecord(record)
    setEditForm({
      name: record.name || '',
      department: record.department || '',
      project: record.project || '',
      direction: record.direction || '',
      deliveryTime: record.deliveryTime || '',
      fee: record.fee != null ? String(record.fee) : '',
      paidAmount: record.paidAmount != null ? String(record.paidAmount) : '',
      feeType: record.feeType || '',
      traffic: record.traffic || '',
      remark: record.remark || '',
      deliveryStatus: record.deliveryStatus || '未开展',
      submitUserName: record.submitUserName || '',
      files: Array.isArray(record.files)
        ? record.files.map((f) => ({
            name: f.name || '',
            url: f.url || f.fileID || '',
            fileID: f.fileID || f.url || '',
            size: f.size,
          }))
        : [],
    })
  }

  const handleCloseEdit = () => {
    setEditingRecord(null)
    setEditForm({})
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const cloudPath = `files/${Date.now()}-${file.name}`
      const res = await cloudbase.app.uploadFile({
        cloudPath,
        filePath: file,
      })
      const fileID = res?.fileID || res?.data?.fileID
      if (fileID) {
        setEditForm((f) => ({
          ...f,
          files: [...(f.files || []), { name: file.name, url: fileID, fileID, size: file.size }],
        }))
        showToast('success', '上传成功')
      } else {
        showToast('error', '上传失败')
      }
    } catch (err) {
      console.error('上传失败', err)
      showToast('error', '上传失败：' + (err?.message || '未知错误'))
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleSaveEdit = async () => {
    if (!editingRecord) return
    try {
      const db = cloudbase.app.database()
      const { files, ...rest } = editForm
      const updateData = {
        name: rest.name ?? '',
        department: rest.department ?? '',
        project: rest.project ?? '',
        direction: rest.direction ?? '',
        deliveryTime: rest.deliveryTime || null,
        fee: rest.fee === '' ? null : rest.fee,
        paidAmount: rest.paidAmount === '' ? null : rest.paidAmount,
        feeType: rest.feeType || null,
        traffic: rest.traffic ?? '',
        remark: rest.remark ?? '',
        // 进度仅教授端可编辑，标书由教授端上传，SuperAdmin 不可编辑
        submitUserName: rest.submitUserName ?? '',
        files: (files || []).filter((f) => f.name || f.url).map((f) => ({
          name: f.name || '',
          url: f.url || '',
          fileID: f.url || f.fileID || '',
          size: f.size,
        })),
        updateTime: new Date(),
      }
      const res = await db.collection('project_manage').doc(editingRecord._id).update(updateData)
      const updated = res?.updated ?? res?.data?.updated ?? 0
      if (updated === 0) {
        showToast(
          'error',
          '保存失败：可能是数据库权限限制，请在 CloudBase 控制台将 project_manage 的写权限设为「所有用户可写」'
        )
        return
      }
      showToast('success', '保存成功')
      handleCloseEdit()
      fetchData()
    } catch (error) {
      console.error('保存失败', error)
      showToast('error', '保存失败：' + (error?.message || '未知错误'))
    }
  }

  const handleConfirmDelivery = async (record) => {
    if (record.deliveryStatus !== '已交付') return
    try {
      const db = cloudbase.app.database()
      await db.collection('project_manage').doc(record._id).update({
        confirmDeliver: true,
        updateTime: new Date(),
      })
      showToast('success', '已确认交付')
      fetchData()
    } catch (error) {
      console.error('确认交付失败', error)
      showToast('error', '操作失败')
    }
  }

  const totalPages = Math.ceil(data.length / PAGE_SIZE) || 1
  const pageData = data.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="w-full py-8 px-[24px]">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">项目管理</h1>
        <div className="flex gap-2">
          <button
            className="btn btn-sm btn-outline"
            onClick={() => setShowAddProfessor(true)}
          >
            添加教授
          </button>
        </div>
      </div>

      {/* 提示消息 */}
      {toast.show && (
        <div
          role="alert"
          className={`alert ${toast.type === 'success' ? 'alert-success' : 'alert-error'} mb-4`}
        >
          <span>{toast.msg}</span>
        </div>
      )}

      <div className="overflow-x-auto">
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <span className="loading loading-spinner loading-lg text-primary"></span>
            <span className="ml-3">加载中...</span>
          </div>
        ) : (
          <>
            <table className="table table-zebra min-w-[1200px] border border-base-300 [&_th]:border [&_th]:border-base-300 [&_td]:border [&_td]:border-base-300">
              <thead>
                <tr>
                  <th>姓名</th>
                  <th>科室</th>
                  <th>项目</th>
                  <th>方向</th>
                  <th>文件</th>
                  <th>交付时间</th>
                  <th className="w-16">费用(万)</th>
                  <th className="w-16">已付金额(万)</th>
                  <th>费用类型</th>
                  <th>导流</th>
                  <th>备注</th>
                  <th>进度</th>
                  <th>标书</th>
                  <th>交付</th>
                  <th>提交人</th>
                  <th>分配对象</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {pageData.length === 0 ? (
                  <tr>
                    <td colSpan={17} className="text-center py-8 text-base-content/60">
                      暂无数据
                    </td>
                  </tr>
                ) : (
                  pageData.map((row) => (
                    <tr key={row._id}>
                      <td>{row.name || '-'}</td>
                      <td>{PROJECT_MAP[row.department] || row.department || '-'}</td>
                      <td>{PROJECT_MAP[row.project] || row.project || '-'}</td>
                      <td>{row.direction || '-'}</td>
                      <td>
                        {row.files && Array.isArray(row.files) && row.files.length > 0 ? (
                          <div className="flex flex-col gap-1">
                            {row.files.map((file, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => handleViewFile(file)}
                                disabled={fileLoading === (file.url || file.fileID)}
                                className="link link-hover text-sm text-left disabled:opacity-70"
                              >
                                {fileLoading === (file.url || file.fileID) ? (
                                  <span className="loading loading-spinner loading-xs mr-1"></span>
                                ) : null}
                                {file.name || `文件${idx + 1}`}
                              </button>
                            ))}
                          </div>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td>{row.deliveryTime || '-'}</td>
                      <td className="w-16">{row.fee != null ? `${Number(row.fee)}` : '-'}</td>
                      <td className="w-16">{row.paidAmount != null ? `${Number(row.paidAmount)}` : '-'}</td>
                      <td>{row.feeType || '-'}</td>
                      <td>{row.traffic ?? '-'}</td>
                      <td className="max-w-[200px] whitespace-normal break-words">
                        {row.remark || '-'}
                      </td>
                      <td>
                        <span
                          className={`badge ${PROGRESS_BADGE[row.deliveryStatus] || 'badge-ghost'}`}
                        >
                          {row.deliveryStatus || '未开展'}
                        </span>
                      </td>
                      <td>
                        {(() => {
                          const doc = row.biddingDoc
                          if (!doc) return '-'
                          if (typeof doc === 'object' && (doc.url || doc.fileID)) {
                            const file = { name: doc.name || '标书', url: doc.url || doc.fileID }
                            return (
                              <button
                                type="button"
                                onClick={() => handleViewFile(file)}
                                disabled={fileLoading === file.url}
                                className="link link-hover text-sm text-left"
                              >
                                {fileLoading === file.url ? (
                                  <span className="loading loading-spinner loading-xs mr-1"></span>
                                ) : null}
                                {file.name}
                              </button>
                            )
                          }
                          return doc
                        })()}
                      </td>
                      <td>
                        <button
                          className="btn btn-sm btn-link"
                          onClick={() => handleConfirmDelivery(row)}
                          disabled={row.deliveryStatus !== '已交付' || row.confirmDeliver}
                        >
                          {row.confirmDeliver ? '已确认' : '确认'}
                        </button>
                      </td>
                      <td>{row.submitUserName || '-'}</td>
                      <td>{getProfessorName(row.assignedTo)}</td>
                      <td>
                        <div className="flex gap-2">
                          <button
                            className="btn btn-sm btn-ghost"
                            onClick={() => handleEdit(row)}
                          >
                            编辑
                          </button>
                          <button
                            className="btn btn-sm btn-ghost"
                            onClick={() => handleAssign(row)}
                          >
                            分配
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {data.length > PAGE_SIZE && (
              <div className="flex justify-between items-center mt-4">
                <span className="text-sm text-base-content/70">
                  共 {data.length} 条
                </span>
                <div className="join">
                  <button
                    className="join-item btn btn-sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                  >
                    «
                  </button>
                  <button className="join-item btn btn-sm btn-active">
                    第 {page} / {totalPages} 页
                  </button>
                  <button
                    className="join-item btn btn-sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                  >
                    »
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* 编辑弹框 */}
      <dialog className={`modal ${editingRecord ? 'modal-open' : ''}`}>
        <div className="modal-box max-w-2xl max-h-[90vh] overflow-y-auto">
          <h3 className="font-bold text-lg mb-4">编辑记录</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="form-control">
              <label className="label"><span className="label-text">姓名</span></label>
              <input
                type="text"
                className="input input-bordered"
                value={editForm.name || ''}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="form-control">
              <label className="label"><span className="label-text">科室</span></label>
              <input
                type="text"
                className="input input-bordered"
                value={editForm.department || ''}
                onChange={(e) => setEditForm((f) => ({ ...f, department: e.target.value }))}
              />
            </div>
            <div className="form-control">
              <label className="label"><span className="label-text">项目</span></label>
              <select
                className="select select-bordered"
                value={editForm.project || ''}
                onChange={(e) => setEditForm((f) => ({ ...f, project: e.target.value }))}
              >
                <option value="">请选择</option>
                {PROJECT_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
            <div className="form-control">
              <label className="label"><span className="label-text">方向</span></label>
              <input
                type="text"
                className="input input-bordered"
                value={editForm.direction || ''}
                onChange={(e) => setEditForm((f) => ({ ...f, direction: e.target.value }))}
              />
            </div>
            <div className="form-control">
              <label className="label"><span className="label-text">交付时间</span></label>
              <input
                type="date"
                className="input input-bordered"
                value={editForm.deliveryTime || ''}
                onChange={(e) => setEditForm((f) => ({ ...f, deliveryTime: e.target.value }))}
              />
            </div>
            <div className="form-control">
              <label className="label"><span className="label-text">费用(万)</span></label>
              <input
                type="text"
                className="input input-bordered"
                value={editForm.fee ?? ''}
                onChange={(e) => setEditForm((f) => ({ ...f, fee: e.target.value }))}
              />
            </div>
            <div className="form-control">
              <label className="label"><span className="label-text">已付金额(万)</span></label>
              <input
                type="text"
                className="input input-bordered"
                value={editForm.paidAmount ?? ''}
                onChange={(e) => setEditForm((f) => ({ ...f, paidAmount: e.target.value }))}
              />
            </div>
            <div className="form-control">
              <label className="label"><span className="label-text">费用类型</span></label>
              <select
                className="select select-bordered"
                value={editForm.feeType || ''}
                onChange={(e) => setEditForm((f) => ({ ...f, feeType: e.target.value }))}
              >
                <option value="">请选择</option>
                {FEE_TYPE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
            <div className="form-control">
              <label className="label"><span className="label-text">导流</span></label>
              <input
                type="text"
                className="input input-bordered"
                value={editForm.traffic || ''}
                onChange={(e) => setEditForm((f) => ({ ...f, traffic: e.target.value }))}
              />
            </div>
            <div className="form-control md:col-span-2">
              <label className="label"><span className="label-text">备注</span></label>
              <textarea
                className="textarea textarea-bordered"
                rows={2}
                value={editForm.remark || ''}
                onChange={(e) => setEditForm((f) => ({ ...f, remark: e.target.value }))}
              />
            </div>
            <div className="form-control">
              <label className="label"><span className="label-text">进度</span></label>
              <div className="py-2 text-sm">
                <span className={`badge ${PROGRESS_BADGE[editForm.deliveryStatus] || 'badge-ghost'}`}>
                  {editForm.deliveryStatus || '未开展'}
                </span>
                <span className="ml-2 text-base-content/60">（由教授端编辑）</span>
              </div>
            </div>
            <div className="form-control">
              <label className="label"><span className="label-text">标书</span></label>
              <div className="py-2 text-sm text-base-content/70">
                {editingRecord?.biddingDoc && typeof editingRecord.biddingDoc === 'object' &&
                (editingRecord.biddingDoc.url || editingRecord.biddingDoc.fileID) ? (
                  <button
                    type="button"
                    onClick={() => handleViewFile(editingRecord.biddingDoc)}
                    className="link link-hover"
                  >
                    {editingRecord.biddingDoc.name || '查看标书'}
                  </button>
                ) : (
                  <span>（由教授端上传，不可编辑）</span>
                )}
              </div>
            </div>
            <div className="form-control">
              <label className="label"><span className="label-text">提交人</span></label>
              <input
                type="text"
                className="input input-bordered"
                value={editForm.submitUserName || ''}
                onChange={(e) => setEditForm((f) => ({ ...f, submitUserName: e.target.value }))}
              />
            </div>
          </div>
          <div className="form-control mt-4 md:col-span-2">
            <label className="label">
              <span className="label-text">文件</span>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileUpload}
              />
              <button
                type="button"
                className="btn btn-sm btn-outline"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploading ? (
                  <>
                    <span className="loading loading-spinner loading-xs"></span>
                    上传中...
                  </>
                ) : (
                  '上传文件'
                )}
              </button>
            </label>
            <div className="space-y-2">
              {(editForm.files || []).map((file, idx) => (
                <div key={idx} className="flex gap-2 items-center py-1 px-2 bg-base-200 rounded-lg">
                  <span className="flex-1 text-sm truncate" title={file.url}>
                    {file.name || `文件${idx + 1}`}
                  </span>
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost btn-square text-error"
                    onClick={() => {
                      const newFiles = (editForm.files || []).filter((_, i) => i !== idx)
                      setEditForm((f) => ({ ...f, files: newFiles }))
                    }}
                    title="删除"
                  >
                    ×
                  </button>
                </div>
              ))}
              {(editForm.files || []).length === 0 && (
                <p className="text-sm text-base-content/50">暂无文件，点击「上传文件」添加</p>
              )}
            </div>
          </div>
          <div className="modal-action">
            <button type="button" className="btn btn-ghost" onClick={handleCloseEdit}>
              取消
            </button>
            <button type="button" className="btn btn-primary" onClick={handleSaveEdit}>
              保存
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop" onClick={handleCloseEdit}>
          <button type="button">关闭</button>
        </form>
      </dialog>

      {/* 分配弹框 */}
      <dialog className={`modal ${assigningRecord ? 'modal-open' : ''}`}>
        <div className="modal-box">
          <h3 className="font-bold text-lg mb-4">分配项目</h3>
          <p className="text-sm text-base-content/70 mb-4">
            将「{assigningRecord?.name || '-'}」分配给教授：
          </p>
          <div className="form-control">
            <label className="label"><span className="label-text">选择教授</span></label>
            <select
              className="select select-bordered"
              value={assignProfessorId}
              onChange={(e) => setAssignProfessorId(e.target.value)}
            >
              <option value="">请选择</option>
              {professors.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name} ({p.phone || p.email || '-'})
                </option>
              ))}
            </select>
          </div>
          <div className="modal-action">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => { setAssigningRecord(null); setAssignProfessorId('') }}
            >
              取消
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleConfirmAssign}
              disabled={!assignProfessorId}
            >
              确认分配
            </button>
          </div>
        </div>
        <form
          method="dialog"
          className="modal-backdrop"
          onClick={() => { setAssigningRecord(null); setAssignProfessorId('') }}
        >
          <button type="button">关闭</button>
        </form>
      </dialog>

      {/* 添加教授弹框 */}
      <dialog className={`modal ${showAddProfessor ? 'modal-open' : ''}`}>
        <div className="modal-box">
          <h3 className="font-bold text-lg mb-4">添加教授</h3>
          <div className="form-control mb-4">
            <label className="label"><span className="label-text">姓名</span></label>
            <input
              type="text"
              className="input input-bordered"
              placeholder="教授姓名"
              value={newProfessor.name}
              onChange={(e) => setNewProfessor((p) => ({ ...p, name: e.target.value }))}
            />
          </div>
          <div className="form-control mb-4">
            <label className="label"><span className="label-text">手机号</span></label>
            <input
              type="tel"
              inputMode="numeric"
              className="input input-bordered"
              placeholder="11 位手机号，需与教授短信登录一致"
              value={newProfessor.phone}
              onChange={(e) => setNewProfessor((p) => ({ ...p, phone: e.target.value }))}
            />
          </div>
          <div className="modal-action">
            <button type="button" className="btn btn-ghost" onClick={() => setShowAddProfessor(false)}>
              取消
            </button>
            <button type="button" className="btn btn-primary" onClick={handleAddProfessor}>
              添加
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop" onClick={() => setShowAddProfessor(false)}>
          <button type="button">关闭</button>
        </form>
      </dialog>
    </div>
  )
}

export default SuperAdmin
