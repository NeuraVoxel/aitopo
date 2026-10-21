/**
 * Minimal topo-diagram host: mount Network, light edit, JSON export.
 * Depends on global Aitopo from ../aitopo.iife.js (pinned host contract).
 */
;(function (global) {
  'use strict'

  /**
   * @param {HTMLElement} container
   * @param {object} doc GraphDocument-like JSON
   * @param {{ layout?: string }} [opts]
   */
  function boot(container, doc, opts) {
    opts = opts || {}
    var Aitopo = global.Aitopo
    if (!Aitopo || typeof Aitopo.Network !== 'function') {
      throw new Error('Aitopo global missing — load aitopo.iife.js first')
    }

    var Network = Aitopo.Network
    var parseDocument = Aitopo.parseDocument
    var CreateEdgeInteraction = Aitopo.CreateEdgeInteraction

    var initial = JSON.parse(JSON.stringify(doc))
    var network = new Network({
      interactions: [new CreateEdgeInteraction({ kind: 'flow' })],
    })
    network.mount(container)
    network.load(parseDocument(doc))
    if (opts.layout) network.layout(opts.layout)

    function exportDocument() {
      return network.toJSON()
    }

    function setAllGroupsExpanded(expanded) {
      var current = network.toJSON()
      var groups = current.groups || []
      if (groups.length === 0) return
      network.apply({
        ops: groups.map(function (g) {
          return { op: 'updateGroup', id: g.id, patch: { expanded: expanded } }
        }),
      })
    }

    function reset() {
      network.load(parseDocument(JSON.parse(JSON.stringify(initial))))
    }

    function destroy() {
      network.destroy()
    }

    return {
      network: network,
      exportDocument: exportDocument,
      setAllGroupsExpanded: setAllGroupsExpanded,
      reset: reset,
      destroy: destroy,
    }
  }

  /**
   * Wire a page that has #canvas, toolbar buttons, and #diagram-data JSON.
   * @param {Document} document
   */
  function bootFromPage(document) {
    var dataEl = document.getElementById('diagram-data')
    var canvas = document.getElementById('canvas')
    if (!dataEl || !canvas) {
      throw new Error('host page needs #diagram-data and #canvas')
    }
    var doc = JSON.parse(dataEl.textContent || '{}')
    var host = boot(canvas, doc)

    function downloadJson() {
      var blob = new Blob([JSON.stringify(host.exportDocument(), null, 2)], {
        type: 'application/json',
      })
      var a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = 'diagram.graph.json'
      a.click()
      URL.revokeObjectURL(a.href)
    }

    async function copyJson() {
      var text = JSON.stringify(host.exportDocument(), null, 2)
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text)
        return
      }
      window.prompt('Copy JSON:', text)
    }

    var byId = function (id) {
      return document.getElementById(id)
    }
    var expandBtn = byId('btn-expand')
    var collapseBtn = byId('btn-collapse')
    var copyBtn = byId('btn-copy')
    var downloadBtn = byId('btn-download')
    var resetBtn = byId('btn-reset')

    if (expandBtn) expandBtn.addEventListener('click', function () { host.setAllGroupsExpanded(true) })
    if (collapseBtn) collapseBtn.addEventListener('click', function () { host.setAllGroupsExpanded(false) })
    if (copyBtn) copyBtn.addEventListener('click', function () { copyJson().catch(function (e) { console.error(e) }) })
    if (downloadBtn) downloadBtn.addEventListener('click', downloadJson)
    if (resetBtn) resetBtn.addEventListener('click', function () { host.reset() })

    return host
  }

  global.TopoDiagramHost = { boot: boot, bootFromPage: bootFromPage }
})(typeof globalThis !== 'undefined' ? globalThis : window)
