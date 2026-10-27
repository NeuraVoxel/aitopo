/**
 * Minimal topo-diagram host: mount Network, optional Edit mode, JSON export.
 * Depends on global Aitopo from ../aitopo.iife.js (pinned host contract).
 */
;(function (global) {
  'use strict'

  /**
   * @param {HTMLElement} container
   * @param {object} doc GraphDocument-like JSON
   * @param {{ layout?: string, fit?: boolean, fitPadding?: number, fitScale?: number, editing?: boolean }} [opts]
   */
  function boot(container, doc, opts) {
    opts = opts || {}
    var Aitopo = global.Aitopo
    if (!Aitopo || typeof Aitopo.Network !== 'function') {
      throw new Error('Aitopo global missing — load aitopo.iife.js first')
    }

    var Network = Aitopo.Network
    var parseDocument = Aitopo.parseDocument
    var fitPadding = opts.fitPadding != null ? opts.fitPadding : 48
    // Slightly under full fit so labels / chrome breathe (1 = exact fitContent).
    var fitScale = opts.fitScale != null ? opts.fitScale : 0.9
    var shouldFit = opts.fit !== false
    // Default basic: pan/zoom + drag-move. Pass editing: true for bend/resize/Alt+link.
    var editing = opts.editing === true

    // Hide until the first framed fit so the default camera never flashes.
    var viewReady = false
    var lastFitW = 0
    var lastFitH = 0
    var prevOpacity = container.style.opacity
    var prevPointerEvents = container.style.pointerEvents

    function conceal() {
      container.style.opacity = '0'
      container.style.pointerEvents = 'none'
    }

    function reveal() {
      if (viewReady) return
      viewReady = true
      container.style.opacity = prevOpacity
      container.style.pointerEvents = prevPointerEvents
    }

    if (shouldFit) conceal()

    var initial = JSON.parse(JSON.stringify(doc))
    // Basic by default (setEditing false = drag/pan). Full edit via menu / opts.editing.
    var network = new Network({
      defaultInteractions: false,
      createEdgeKind: 'flow',
      // Centered title/subtitle stack — icons would occupy the same center.
      showNodeIcons: false,
    })
    network.mount(container)
    network.load(parseDocument(doc))
    if (typeof network.setEditing === 'function') {
      network.setEditing(editing)
    }
    if (opts.layout) network.layout(opts.layout)

    function fitContent() {
      var bounds = typeof network.contentBounds === 'function'
        ? network.contentBounds()
        : undefined
      if (
        bounds
        && typeof network.updateCamera === 'function'
        && fitScale > 0
        && fitScale !== 1
      ) {
        // Inflate content bounds by 1/fitScale so the fitted zoom is ~fitScale
        // of a full fit, still centered (skill framing; engine default unchanged).
        var cx = bounds.x + bounds.width / 2
        var cy = bounds.y + bounds.height / 2
        var w = Math.max(1, bounds.width / fitScale)
        var h = Math.max(1, bounds.height / fitScale)
        network.updateCamera(function (viewport) {
          viewport.fitBounds(
            { x: cx - w / 2, y: cy - h / 2, width: w, height: h },
            fitPadding,
          )
        })
      } else if (typeof network.fitContent === 'function') {
        network.fitContent(fitPadding)
      }
      lastFitW = container.clientWidth
      lastFitH = container.clientHeight
    }

    /**
     * Fit under opacity:0, then reveal. Double-rAF lets flex layout settle
     * before the first visible frame.
     */
    function scheduleFit() {
      if (!shouldFit) {
        reveal()
        return
      }
      if (viewReady) {
        // Post-boot (reset / explicit): keep current visibility.
        global.requestAnimationFrame(function () {
          global.requestAnimationFrame(fitContent)
        })
        return
      }
      conceal()
      global.requestAnimationFrame(function () {
        fitContent()
        global.requestAnimationFrame(function () {
          fitContent()
          reveal()
        })
      })
    }

    scheduleFit()

    // Reframe when entering / leaving a SubNetwork (camera otherwise stays on the parent).
    if (typeof network.on === 'function') {
      network.on(function (event) {
        if (event && event.type === 'subNetworkChanged') scheduleFit()
      })
    }

    /** Full root document (nested networks included), active leaf flushed. */
    function exportDocument() {
      if (typeof network.toRootJSON === 'function') return network.toRootJSON()
      return network.toJSON()
    }

    function setEditing(enabled) {
      editing = enabled === true
      if (typeof network.setEditing === 'function') {
        network.setEditing(editing)
      }
      return editing
    }

    function isEditing() {
      return editing
    }

    function setAllGroupsExpanded(expanded) {
      // Prefer toggleGroupExpanded so collapse snapshots band geometry and the
      // engine dirties remapped cross-edge paint (raw {expanded} alone skips that).
      var current = network.toJSON()
      var groups = current.groups || []
      if (groups.length === 0) return
      if (typeof network.toggleGroupExpanded === 'function') {
        for (var i = 0; i < groups.length; i++) {
          var g = groups[i]
          var isOpen = g.expanded === true
          if (isOpen === expanded) continue
          network.toggleGroupExpanded(g.id)
        }
        return
      }
      network.apply({
        ops: groups.map(function (g) {
          return { op: 'updateGroup', id: g.id, patch: { expanded: expanded } }
        }),
      })
    }

    function reset() {
      viewReady = false
      network.load(parseDocument(JSON.parse(JSON.stringify(initial))))
      if (typeof network.setEditing === 'function') {
        network.setEditing(editing)
      }
      scheduleFit()
    }

    function destroy() {
      network.destroy()
    }

    /**
     * ResizeObserver path: skip until first reveal; ignore no-op size changes
     * so a deferred boot observe does not repaint after reveal.
     */
    function fitIfSizeChanged() {
      if (!shouldFit || !viewReady) return
      var w = container.clientWidth
      var h = container.clientHeight
      if (w === lastFitW && h === lastFitH) return
      fitContent()
    }

    return {
      network: network,
      exportDocument: exportDocument,
      setEditing: setEditing,
      isEditing: isEditing,
      setAllGroupsExpanded: setAllGroupsExpanded,
      fitContent: fitContent,
      fitIfSizeChanged: fitIfSizeChanged,
      reset: reset,
      destroy: destroy,
    }
  }

  /**
   * Wire a page that has #canvas, topbar/menu, and #diagram-data JSON.
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
    var toolbar = byId('toolbar')
    var toggleBtn = byId('btn-toolbar-toggle')
    var menu = byId('toolbar-menu')
    var titleEl = byId('page-title')
    var eyebrowEl = byId('page-eyebrow')
    var ledeEl = byId('page-lede')
    var ledeMoreEl = byId('page-lede-more')
    var fitBtn = byId('btn-fit')
    var expandBtn = byId('btn-expand')
    var collapseBtn = byId('btn-collapse')
    var editBtn = byId('btn-edit')
    var copyBtn = byId('btn-copy')
    var downloadBtn = byId('btn-download')
    var excalidrawBtn = byId('btn-export-excalidraw')
    var drawioBtn = byId('btn-export-drawio')
    var pngBtn = byId('btn-export-png')
    var svgBtn = byId('btn-export-svg')
    var resetBtn = byId('btn-reset')
    var hintEl = menu && menu.querySelector
      ? menu.querySelector('.toolbar-hint')
      : null

    var exporters =
      global.TopoDiagramExport && typeof global.TopoDiagramExport.bindExports === 'function'
        ? global.TopoDiagramExport.bindExports({
          network: host.network,
          exportDocument: host.exportDocument,
          activeDocument: function () { return host.network.toJSON() },
        })
        : null

    // Root chrome snapshot — exit SubNetwork / reset restore this.
    var rootMeta = doc.meta && typeof doc.meta === 'object' ? doc.meta : {}

    /**
     * Apply GraphDocument meta to the topbar.
     * `meta.summary` may be two lines separated by `\n` → `#page-lede` + `#page-lede-more`.
     * @param {object|undefined|null} meta
     */
    function applyChrome(meta) {
      meta = meta && typeof meta === 'object' ? meta : {}
      if (titleEl && typeof meta.title === 'string' && meta.title) {
        titleEl.textContent = meta.title
        document.title = meta.title
      }
      if (eyebrowEl) {
        if (typeof meta.eyebrow === 'string' && meta.eyebrow) {
          eyebrowEl.textContent = meta.eyebrow
        } else if (typeof meta.kind === 'string' && meta.kind) {
          eyebrowEl.textContent = meta.kind
        } else {
          eyebrowEl.textContent = ''
        }
      }
      var summary = typeof meta.summary === 'string' ? meta.summary : ''
      var parts = summary.split('\n')
      var line1 = (parts[0] || '').trim()
      var line2 = parts.slice(1).join('\n').trim()
      if (ledeEl) ledeEl.textContent = line1
      if (ledeMoreEl) {
        ledeMoreEl.textContent = line2
        if (line2) ledeMoreEl.removeAttribute('hidden')
        else ledeMoreEl.setAttribute('hidden', '')
      }
    }

    function chromeFromActive() {
      var active = host.network.toJSON()
      var meta = active && active.meta
      // Nested docs without meta fall back to empty chrome (not root) so layers stay distinct.
      if (host.network.currentNetworkId == null) {
        applyChrome(meta && typeof meta === 'object' ? meta : rootMeta)
      } else {
        applyChrome(meta)
      }
    }

    function syncEditChrome() {
      var on = host.isEditing()
      if (editBtn) {
        editBtn.setAttribute('aria-checked', on ? 'true' : 'false')
        editBtn.classList.toggle('is-checked', on)
        editBtn.textContent = on ? 'Edit mode ✓' : 'Edit mode'
      }
      if (toolbar) toolbar.classList.toggle('is-editing', on)
      if (hintEl) {
        hintEl.textContent = on
          ? 'Edit: drag · bend · resize · Alt+drag link · Delete edge · double-click group/portal'
          : 'Pan/zoom · drag nodes · Shift-marquee · double-click group/portal · empty to exit'
      }
    }

    applyChrome(rootMeta)
    syncEditChrome()

    if (typeof host.network.on === 'function') {
      host.network.on(function (event) {
        if (event && event.type === 'subNetworkChanged') chromeFromActive()
      })
    }

    function setMenuOpen(open) {
      if (!toolbar || !toggleBtn || !menu) return
      toolbar.classList.toggle('is-open', open)
      toggleBtn.setAttribute('aria-expanded', open ? 'true' : 'false')
      if (open) menu.removeAttribute('hidden')
      else menu.setAttribute('hidden', '')
    }

    if (toggleBtn && toolbar && menu) {
      toggleBtn.addEventListener('click', function (e) {
        e.stopPropagation()
        setMenuOpen(!toolbar.classList.contains('is-open'))
      })
      document.addEventListener('click', function (e) {
        if (!toolbar.classList.contains('is-open')) return
        if (toolbar.contains(e.target)) return
        setMenuOpen(false)
      })
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') setMenuOpen(false)
      })
    }

    function runAndClose(fn) {
      return function () {
        fn()
        setMenuOpen(false)
      }
    }

    if (fitBtn) fitBtn.addEventListener('click', runAndClose(function () { host.fitContent() }))
    if (expandBtn) expandBtn.addEventListener('click', runAndClose(function () { host.setAllGroupsExpanded(true) }))
    if (collapseBtn) collapseBtn.addEventListener('click', runAndClose(function () { host.setAllGroupsExpanded(false) }))
    if (editBtn) {
      editBtn.addEventListener('click', function () {
        host.setEditing(!host.isEditing())
        syncEditChrome()
        // Keep menu open so the checkmark is visible; outside click still closes.
      })
    }
    if (copyBtn) {
      copyBtn.addEventListener('click', runAndClose(function () {
        copyJson().catch(function (e) { console.error(e) })
      }))
    }
    if (downloadBtn) downloadBtn.addEventListener('click', runAndClose(downloadJson))
    if (exporters) {
      if (excalidrawBtn) {
        excalidrawBtn.addEventListener('click', runAndClose(function () {
          exporters.downloadExcalidraw()
        }))
      }
      if (drawioBtn) {
        drawioBtn.addEventListener('click', runAndClose(function () {
          exporters.downloadDrawio()
        }))
      }
      if (pngBtn) {
        pngBtn.addEventListener('click', runAndClose(function () {
          exporters.downloadPng()
        }))
      }
      if (svgBtn) {
        svgBtn.addEventListener('click', runAndClose(function () {
          exporters.downloadSvg()
        }))
      }
    }
    if (resetBtn) {
      resetBtn.addEventListener('click', runAndClose(function () {
        host.reset()
        applyChrome(rootMeta)
        syncEditChrome()
      }))
    }

    if (typeof ResizeObserver === 'function') {
      var resizeTimer = null
      var observer = new ResizeObserver(function () {
        if (resizeTimer) global.clearTimeout(resizeTimer)
        resizeTimer = global.setTimeout(function () {
          host.fitIfSizeChanged()
        }, 120)
      })
      observer.observe(canvas)
    }

    return host
  }

  global.TopoDiagramHost = { boot: boot, bootFromPage: bootFromPage }
})(typeof globalThis !== 'undefined' ? globalThis : window)
