import React, { useState, useEffect, useRef } from 'react'
import cloudbase from '../utils/cloudbase'
import { useAuth } from '../contexts/AuthContext'

const PROJECT_MAP = {
  '中管局': '中管局',
  '卫生厅': '卫生厅',
  '省自然': '省自然',
  '国青': '国青',
  '面上': '面上',
  '其他': '其他',
}

const PROGRESS_BADGE = {
  已交付: 'badge-success',
  进展中: 'badge-info',
  未开展: 'badge-ghost',
}

const PAGE_SIZE = 10
const STATUS_OPTIONS = ['未开展', '进展中', '已交付']

const ProfessorPage = () => {
  const { currentProfessor } = useAuth()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState({ show: false, type: '', msg: '' })
  const [page, setPage] = useState(1)
  const [fileLoading, setFileLoading] = useState(null)
  const [uploading, setUploading] = useState(null) // 正在上传标书的记录 _id
  const fileInputRef = useRef(null)
  const uploadingRecordRef = useRef(null)

  const fetchData = async () => {
    if (!currentProfessor?._id) {
      setData([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const db = cloudbase.app.database()
      const res = await db.collection('project_manage').where({
        assignedTo: currentProfessor._id,
      }).get()
      setData(res.data || [])
    } catch (error) {
      console.error('获取数据失败', error)
      showToast('error', '加载数据失败')
      setData([])
    } finally {
      setLoading(false)
    }
  }

  const showToast = (type, msg) => {
    setToast({ show: true, type, msg })
    setTimeout(() => setToast({ show: false, type: '', msg: '' }), 2000)
  }

  const handleProgressChange = async (row, newStatus) => {
    try {
      const db = cloudbase.app.database()
      await db.collection('project_manage').doc(row._id).update({
        deliveryStatus: newStatus,
        updateTime: new Date(),
      })
      showToast('success', '进度已更新')
      fetchData()
    } catch (err) {
      console.error('更新进度失败', err)
      showToast('error', '更新失败')
    }
  }

  useEffect(() => {
    fetchData()
  }, [currentProfessor?._id])

  const handleViewFile = async (file) => {
    const fileID = file?.url || file?.fileID
    if (!fileID) return
    if (fileID.startsWith('http')) {
      window.open(fileID, '_blank')
      return
    }
    if (!fileID.startsWith('cloud://')) return

    setFileLoading(fileID)
    try {
      const res = await cloudbase.app.getTempFileURL({ fileList: [fileID] })
      const list = res?.fileList ?? res?.data?.download_list ?? []
      const item = list[0]
      const fileUrl = item?.tempFileURL || item?.download_url

      if (!fileUrl) {
        if (item?.code === 'STORAGE_EXCEED_AUTHORITY') {
          showToast('error', '无权限访问此文件')
        } else {
          showToast('error', '获取文件链接失败')
        }
        return
      }
      try {
        const resp = await fetch(fileUrl, { mode: 'cors' })
        if (!resp.ok) throw new Error(resp.statusText)
        const blob = await resp.blob()
        const blobUrl = URL.createObjectURL(blob)
        window.open(blobUrl, '_blank')
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60000)
      } catch {
        window.open(fileUrl, '_blank')
      }
    } catch (err) {
      showToast('error', '获取文件链接失败')
    } finally {
      setFileLoading(null)
    }
  }

  const handleUploadBiddingDoc = (record) => {
    uploadingRecordRef.current = record
    fileInputRef.current?.click()
  }

  const onBiddingDocFileChange = async (e) => {
    const file = e.target.files?.[0]
    const record = uploadingRecordRef.current
    if (!file || !record) return

    setUploading(record._id)
    try {
      const cloudPath = `bidding/${Date.now()}-${file.name}`
      const res = await cloudbase.app.uploadFile({
        cloudPath,
        filePath: file,
      })
      const fileID = res?.fileID || res?.data?.fileID
      if (fileID) {
        const db = cloudbase.app.database()
        const _ = db.command
        // 使用 command.set 整体替换 biddingDoc，避免原字段为字符串时点号更新报错
        await db.collection('project_manage').doc(record._id).update({
          biddingDoc: _.set({ name: file.name, url: fileID, fileID, size: file.size }),
          updateTime: new Date(),
        })
        showToast('success', '标书上传成功')
        fetchData()
      } else {
        showToast('error', '上传失败')
      }
    } catch (err) {
      console.error('上传失败', err)
      showToast('error', '上传失败：' + (err?.message || '未知错误'))
    } finally {
      setUploading(null)
      uploadingRecordRef.current = null
      e.target.value = ''
    }
  }

  const getBiddingDoc = (row) => {
    const doc = row.biddingDoc
    if (!doc) return null
    if (typeof doc === 'object' && (doc.url || doc.fileID)) {
      return { name: doc.name || '标书', url: doc.url || doc.fileID }
    }
    return null
  }

  const totalPages = Math.ceil(data.length / PAGE_SIZE) || 1
  const pageData = data.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-6">项目管理（教授端）</h1>

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={onBiddingDocFileChange}
      />

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
            <table className="table table-zebra min-w-[1000px] border border-base-300 [&_th]:border [&_th]:border-base-300 [&_td]:border [&_td]:border-base-300">
              <thead>
                <tr>
                  <th>姓名</th>
                  <th>科室</th>
                  <th>项目</th>
                  <th>方向</th>
                  <th>文件</th>
                  <th>时间</th>
                  <th>费用</th>
                  <th>备注</th>
                  <th>进度</th>
                  <th>标书</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {pageData.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="text-center py-8 text-base-content/60">
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
                        {row.files && row.files.length > 0 ? (
                          <div className="flex flex-col gap-1">
                            {row.files.map((file, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => handleViewFile(file)}
                                disabled={fileLoading === (file.url || file.fileID)}
                                className="link link-hover text-sm text-left"
                              >
                                {file.name || `文件${idx + 1}`}
                              </button>
                            ))}
                          </div>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td>{row.deliveryTime || '-'}</td>
                      <td>
                        {row.fee != null
                          ? typeof row.fee === 'number'
                            ? `¥${row.fee.toFixed(2)}`
                            : row.fee
                          : '-'}
                      </td>
                      <td className="max-w-[120px] truncate" title={row.remark}>
                        {row.remark || '-'}
                      </td>
                      <td>
                        <select
                          className="select select-bordered select-sm"
                          value={row.deliveryStatus || '未开展'}
                          onChange={(e) => handleProgressChange(row, e.target.value)}
                        >
                          {STATUS_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        {(() => {
                          const doc = getBiddingDoc(row)
                          if (doc) {
                            return (
                              <button
                                type="button"
                                onClick={() => handleViewFile(doc)}
                                disabled={fileLoading === doc.url}
                                className="link link-hover text-sm"
                              >
                                {doc.name}
                              </button>
                            )
                          }
                          return <span className="text-base-content/50">未上传</span>
                        })()}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline"
                          disabled={uploading === row._id}
                          onClick={() => handleUploadBiddingDoc(row)}
                        >
                          {uploading === row._id ? (
                            <>
                              <span className="loading loading-spinner loading-xs mr-1"></span>
                              上传中
                            </>
                          ) : (
                            '上传标书'
                          )}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {data.length > PAGE_SIZE && (
              <div className="flex justify-between items-center mt-4">
                <span className="text-sm text-base-content/70">共 {data.length} 条</span>
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
    </div>
  )
}

export default ProfessorPage
