/**
 * Minimal topo-diagram host: mount Network, light edit, JSON export.
 * Depends on global Aitopo from ../aitopo.iife.js (pinned host contract).
 */
;(function (global) {
  'use strict'

  /**
   * @param {HTMLElement} container
   * @param {object} doc GraphDocument-like JSON
   * @param {{ layout?: string, fit?: boolean, fitPadding?: number, fitScale?: number }} [opts]
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
    var fitPadding = opts.fitPadding != null ? opts.fitPadding : 48
    // Slightly under full fit so labels / chrome breathe (1 = exact fitContent).
    var fitScale = opts.fitScale != null ? opts.fitScale : 0.9
    var shouldFit = opts.fit !== false

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
    var network = new Network({
      interactions: [new CreateEdgeInteraction({ kind: 'flow' })],
      // Centered title/subtitle stack — icons would occupy the same center.
      showNodeIcons: false,
    })
    network.mount(container)
    network.load(parseDocument(doc))
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
      viewReady = false
      network.load(parseDocument(JSON.parse(JSON.stringify(initial))))
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
    var fitBtn = byId('btn-fit')
    var expandBtn = byId('btn-expand')
    var collapseBtn = byId('btn-collapse')
    var copyBtn = byId('btn-copy')
    var downloadBtn = byId('btn-download')
    var resetBtn = byId('btn-reset')

    if (doc.meta && typeof doc.meta === 'object') {
      if (titleEl && typeof doc.meta.title === 'string' && doc.meta.title) {
        titleEl.textContent = doc.meta.title
        if (document.title === 'topo-diagram sample' || !document.title) {
          document.title = doc.meta.title
        }
      }
      if (eyebrowEl) {
        if (typeof doc.meta.eyebrow === 'string' && doc.meta.eyebrow) {
          eyebrowEl.textContent = doc.meta.eyebrow
        } else if (typeof doc.meta.kind === 'string' && doc.meta.kind) {
          eyebrowEl.textContent = doc.meta.kind
        }
      }
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
    if (copyBtn) {
      copyBtn.addEventListener('click', runAndClose(function () {
        copyJson().catch(function (e) { console.error(e) })
      }))
    }
    if (downloadBtn) downloadBtn.addEventListener('click', runAndClose(downloadJson))
    if (resetBtn) resetBtn.addEventListener('click', runAndClose(function () { host.reset() }))

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
