/**
 * GraphDocument → Excalidraw / draw.io / SVG, plus Network canvas → PNG.
 * Skill-host only (no engine dependency beyond a live Network for PNG).
 */
;(function (global) {
  'use strict'

  var PAPER = '#f5f5f5'
  var INK = '#000000'
  var MUTED = '#4f5d75'

  function downloadBlob(filename, blob) {
    var a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = filename
    a.click()
    URL.revokeObjectURL(a.href)
  }

  function downloadText(filename, text, mime) {
    downloadBlob(filename, new Blob([text], { type: mime || 'text/plain;charset=utf-8' }))
  }

  function escapeXml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  function nodeBox(n) {
    return {
      id: n.id,
      x: n.x != null ? n.x : 0,
      y: n.y != null ? n.y : 0,
      w: n.w != null ? n.w : 120,
      h: n.h != null ? n.h : 48,
      label: n.label || n.id,
      label2: n.label2 || '',
      fill: (n.data && n.data.fill) || '#ffffff',
      stroke: (n.data && n.data.stroke) || INK,
    }
  }

  function anchorPoint(box, side) {
    var cx = box.x + box.w / 2
    var cy = box.y + box.h / 2
    if (side === 'left') return { x: box.x, y: cy }
    if (side === 'right') return { x: box.x + box.w, y: cy }
    if (side === 'top') return { x: cx, y: box.y }
    if (side === 'bottom') return { x: cx, y: box.y + box.h }
    return { x: cx, y: cy }
  }

  function pickSides(a, b) {
    var acx = a.x + a.w / 2
    var acy = a.y + a.h / 2
    var bcx = b.x + b.w / 2
    var bcy = b.y + b.h / 2
    if (Math.abs(bcx - acx) >= Math.abs(bcy - acy)) {
      return acx <= bcx ? ['right', 'left'] : ['left', 'right']
    }
    return acy <= bcy ? ['bottom', 'top'] : ['top', 'bottom']
  }

  /** Orthogonal polyline including endpoints. */
  function edgePoints(fromBox, toBox, edge) {
    var sides = pickSides(fromBox, toBox)
    var fa = edge.fromAnchor || sides[0]
    var ta = edge.toAnchor || sides[1]
    var from = anchorPoint(fromBox, fa)
    var to = anchorPoint(toBox, ta)
    var wps = edge.waypoints || []
    var raw = [from].concat(wps.map(function (p) { return { x: p.x, y: p.y } })).concat([to])
    return orthogonalize(raw)
  }

  function orthogonalize(points) {
    if (points.length < 2) return points.slice()
    var out = [{ x: points[0].x, y: points[0].y }]
    for (var i = 1; i < points.length; i += 1) {
      var prev = out[out.length - 1]
      var next = points[i]
      var dx = Math.abs(next.x - prev.x)
      var dy = Math.abs(next.y - prev.y)
      if (dx < 0.5 && dy < 0.5) continue
      if (dx < 0.5 || dy < 0.5) {
        out.push({ x: next.x, y: next.y })
        continue
      }
      out.push({ x: next.x, y: prev.y })
      out.push({ x: next.x, y: next.y })
    }
    return out
  }

  function contentBounds(doc) {
    var minX = Infinity
    var minY = Infinity
    var maxX = -Infinity
    var maxY = -Infinity
    function grow(x, y, w, h) {
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x + (w || 0))
      maxY = Math.max(maxY, y + (h || 0))
    }
    ;(doc.nodes || []).forEach(function (n) {
      grow(n.x || 0, n.y || 0, n.w || 120, n.h || 48)
    })
    ;(doc.groups || []).forEach(function (g) {
      if (g.x != null) grow(g.x, g.y || 0, g.w || 0, g.h || 0)
    })
    if (!isFinite(minX)) return { x: 0, y: 0, w: 800, h: 600 }
    var pad = 48
    return {
      x: minX - pad,
      y: minY - pad,
      w: Math.max(100, maxX - minX + pad * 2),
      h: Math.max(100, maxY - minY + pad * 2),
    }
  }

  function edgeStroke(edge) {
    return (edge.style && edge.style.stroke) || MUTED
  }

  function edgeDashed(edge) {
    var d = edge.style && edge.style.strokeDash
    return Array.isArray(d) && d.length > 0
  }

  // ── SVG ──────────────────────────────────────────────────────────

  function toSvg(doc) {
    var boxes = {}
    ;(doc.nodes || []).forEach(function (n) { boxes[n.id] = nodeBox(n) })
    var b = contentBounds(doc)
    var parts = []
    parts.push('<?xml version="1.0" encoding="UTF-8"?>')
    parts.push(
      '<svg xmlns="http://www.w3.org/2000/svg" width="' +
        Math.round(b.w) +
        '" height="' +
        Math.round(b.h) +
        '" viewBox="' +
        b.x +
        ' ' +
        b.y +
        ' ' +
        b.w +
        ' ' +
        b.h +
        '">',
    )
    parts.push('<rect x="' + b.x + '" y="' + b.y + '" width="' + b.w + '" height="' + b.h + '" fill="' + PAPER + '"/>')
    ;(doc.groups || []).forEach(function (g) {
      if (g.expanded === false) return
      if (g.x == null) return
      var gf = (g.style && g.style.fill) || 'rgba(45,49,66,0.02)'
      var gs = (g.style && g.style.stroke) || 'rgba(45,49,66,0.15)'
      parts.push(
        '<rect x="' + g.x + '" y="' + (g.y || 0) + '" width="' + (g.w || 0) +
          '" height="' + (g.h || 0) + '" rx="8" fill="' + gf + '" stroke="' + gs + '" stroke-width="1"/>',
      )
      if (g.label) {
        parts.push(
          '<text x="' + (g.x + 16) + '" y="' + ((g.y || 0) + 22) +
            '" fill="' + MUTED + '" font-size="12" font-family="system-ui,sans-serif">' +
            escapeXml(g.label) + '</text>',
        )
      }
    })
    ;(doc.edges || []).forEach(function (e) {
      var a = boxes[e.from]
      var c = boxes[e.to]
      if (!a || !c) return
      var pts = edgePoints(a, c, e)
      var d = pts.map(function (p, i) {
        return (i === 0 ? 'M ' : 'L ') + p.x + ' ' + p.y
      }).join(' ')
      var stroke = edgeStroke(e)
      var dash = edgeDashed(e) ? ' stroke-dasharray="5 4"' : ''
      parts.push(
        '<path d="' + d + '" fill="none" stroke="' + stroke +
          '" stroke-width="1.25"' + dash + ' marker-end="url(#arrow)"/>',
      )
      if (e.label && pts.length >= 2) {
        var mid = pts[Math.floor(pts.length / 2)]
        parts.push(
          '<text x="' + mid.x + '" y="' + (mid.y - 6) +
            '" fill="' + stroke + '" font-size="11" text-anchor="middle" font-family="system-ui,sans-serif">' +
            escapeXml(e.label) + '</text>',
        )
      }
    })
    parts.push(
      '<defs><marker id="arrow" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">' +
        '<polygon points="0 0, 8 3, 0 6" fill="' + MUTED + '"/></marker></defs>',
    )
    Object.keys(boxes).forEach(function (id) {
      var n = boxes[id]
      parts.push(
        '<rect x="' + n.x + '" y="' + n.y + '" width="' + n.w + '" height="' + n.h +
          '" rx="6" fill="' + n.fill + '" stroke="' + n.stroke + '" stroke-width="1.25"/>',
      )
      var ty = n.label2 ? n.y + n.h / 2 - 4 : n.y + n.h / 2 + 4
      parts.push(
        '<text x="' + (n.x + n.w / 2) + '" y="' + ty +
          '" fill="' + INK + '" font-size="12" font-weight="600" text-anchor="middle" font-family="system-ui,sans-serif">' +
          escapeXml(n.label) + '</text>',
      )
      if (n.label2) {
        parts.push(
          '<text x="' + (n.x + n.w / 2) + '" y="' + (n.y + n.h / 2 + 12) +
            '" fill="' + MUTED + '" font-size="10" text-anchor="middle" font-family="ui-monospace,monospace">' +
            escapeXml(n.label2) + '</text>',
        )
      }
    })
    parts.push('</svg>')
    return parts.join('\n')
  }

  // ── Excalidraw ───────────────────────────────────────────────────

  function eid() {
    return 'el_' + Math.random().toString(36).slice(2, 10)
  }

  function toExcalidraw(doc) {
    var boxes = {}
    ;(doc.nodes || []).forEach(function (n) { boxes[n.id] = nodeBox(n) })
    var elements = []
    var seed = 1

    Object.keys(boxes).forEach(function (id) {
      var n = boxes[id]
      var rectId = eid()
      elements.push({
        id: rectId,
        type: 'rectangle',
        x: n.x,
        y: n.y,
        width: n.w,
        height: n.h,
        angle: 0,
        strokeColor: n.stroke,
        backgroundColor: n.fill === '#ffffff' ? 'transparent' : n.fill,
        fillStyle: 'solid',
        strokeWidth: 1,
        strokeStyle: 'solid',
        roughness: 0,
        opacity: 100,
        groupIds: [],
        roundness: { type: 3 },
        seed: seed++,
        version: 1,
        versionNonce: seed++,
        isDeleted: false,
        boundElements: [{ id: rectId + '_t', type: 'text' }],
        updated: 1,
        link: null,
        locked: false,
      })
      elements.push({
        id: rectId + '_t',
        type: 'text',
        x: n.x + 8,
        y: n.y + n.h / 2 - 10,
        width: n.w - 16,
        height: 24,
        angle: 0,
        strokeColor: INK,
        backgroundColor: 'transparent',
        fillStyle: 'solid',
        strokeWidth: 1,
        strokeStyle: 'solid',
        roughness: 0,
        opacity: 100,
        groupIds: [],
        roundness: null,
        seed: seed++,
        version: 1,
        versionNonce: seed++,
        isDeleted: false,
        boundElements: null,
        updated: 1,
        link: null,
        locked: false,
        text: n.label2 ? n.label + '\n' + n.label2 : n.label,
        fontSize: 14,
        fontFamily: 3,
        textAlign: 'center',
        verticalAlign: 'middle',
        containerId: rectId,
        originalText: n.label2 ? n.label + '\n' + n.label2 : n.label,
        autoResize: true,
        lineHeight: 1.25,
      })
    })

    ;(doc.edges || []).forEach(function (e) {
      var a = boxes[e.from]
      var c = boxes[e.to]
      if (!a || !c) return
      var pts = edgePoints(a, c, e)
      if (pts.length < 2) return
      var start = pts[0]
      var points = pts.map(function (p) {
        return [p.x - start.x, p.y - start.y]
      })
      elements.push({
        id: eid(),
        type: 'arrow',
        x: start.x,
        y: start.y,
        width: pts[pts.length - 1].x - start.x,
        height: pts[pts.length - 1].y - start.y,
        angle: 0,
        strokeColor: edgeStroke(e),
        backgroundColor: 'transparent',
        fillStyle: 'solid',
        strokeWidth: 1,
        strokeStyle: edgeDashed(e) ? 'dashed' : 'solid',
        roughness: 0,
        opacity: 100,
        groupIds: [],
        roundness: { type: 2 },
        seed: seed++,
        version: 1,
        versionNonce: seed++,
        isDeleted: false,
        boundElements: null,
        updated: 1,
        link: null,
        locked: false,
        points: points,
        lastCommittedPoint: null,
        startBinding: null,
        endBinding: null,
        startArrowhead: null,
        endArrowhead: 'arrow',
      })
    })

    return {
      type: 'excalidraw',
      version: 2,
      source: 'https://aitopo.topo-diagram-skill',
      elements: elements,
      appState: {
        viewBackgroundColor: PAPER,
        gridSize: null,
      },
      files: {},
    }
  }

  // ── draw.io ──────────────────────────────────────────────────────

  function toDrawio(doc) {
    var boxes = {}
    ;(doc.nodes || []).forEach(function (n) { boxes[n.id] = nodeBox(n) })
    var cells = []
    cells.push('<mxCell id="0"/>')
    cells.push('<mxCell id="1" parent="0"/>')

    Object.keys(boxes).forEach(function (id) {
      var n = boxes[id]
      var value = n.label2 ? escapeXml(n.label) + '&#xa;' + escapeXml(n.label2) : escapeXml(n.label)
      var style =
        'rounded=1;whiteSpace=wrap;html=1;fillColor=' +
        n.fill +
        ';strokeColor=' +
        n.stroke +
        ';fontColor=' +
        INK +
        ';fontStyle=1;align=center;verticalAlign=middle;'
      cells.push(
        '<mxCell id="' +
          escapeXml(id) +
          '" value="' +
          value +
          '" style="' +
          style +
          '" vertex="1" parent="1">' +
          '<mxGeometry x="' +
          n.x +
          '" y="' +
          n.y +
          '" width="' +
          n.w +
          '" height="' +
          n.h +
          '" as="geometry"/>' +
          '</mxCell>',
      )
    })

    ;(doc.edges || []).forEach(function (e, i) {
      var a = boxes[e.from]
      var c = boxes[e.to]
      if (!a || !c) return
      var pts = edgePoints(a, c, e)
      var stroke = edgeStroke(e)
      var style =
        'edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=' +
        stroke +
        ';endArrow=block;endFill=1;' +
        (edgeDashed(e) ? 'dashed=1;dashPattern=5 4;' : '')
      var mid = ''
      if (pts.length > 2) {
        var arr = pts.slice(1, -1).map(function (p) {
          return '<mxPoint x="' + p.x + '" y="' + p.y + '"/>'
        }).join('')
        mid = '<Array as="points">' + arr + '</Array>'
      }
      var label = e.label ? ' value="' + escapeXml(e.label) + '"' : ' value=""'
      cells.push(
        '<mxCell id="e' +
          i +
          '"' +
          label +
          ' style="' +
          style +
          '" edge="1" parent="1" source="' +
          escapeXml(e.from) +
          '" target="' +
          escapeXml(e.to) +
          '">' +
          '<mxGeometry relative="1" as="geometry">' +
          mid +
          '</mxGeometry>' +
          '</mxCell>',
      )
    })

    return (
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<mxfile host="aitopo.topo-diagram-skill" modified="' +
      new Date().toISOString() +
      '" agent="topo-diagram" version="21.0.0" type="device">' +
      '<diagram id="diagram" name="topo">' +
      '<mxGraphModel dx="1200" dy="800" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1600" pageHeight="1200" math="0" shadow="0">' +
      '<root>' +
      cells.join('') +
      '</root></mxGraphModel></diagram></mxfile>'
    )
  }

  // ── PNG (live Network canvases) ──────────────────────────────────

  function toPngBlob(network, done) {
    var view = network.getViewElement && network.getViewElement()
    if (!view) {
      done(new Error('Network not mounted'))
      return
    }
    var canvases = view.querySelectorAll('canvas')
    var root = canvases[0]
    if (!root) {
      done(new Error('No canvas'))
      return
    }
    var overlay = canvases[1]
    var out = document.createElement('canvas')
    out.width = root.width
    out.height = root.height
    var ctx = out.getContext('2d')
    ctx.fillStyle = PAPER
    ctx.fillRect(0, 0, out.width, out.height)
    ctx.drawImage(root, 0, 0)
    if (overlay) ctx.drawImage(overlay, 0, 0)
    if (out.toBlob) {
      out.toBlob(function (blob) {
        if (!blob) done(new Error('toBlob failed'))
        else done(null, blob)
      }, 'image/png')
    } else {
      try {
        var data = out.toDataURL('image/png')
        var bin = atob(data.split(',')[1])
        var arr = new Uint8Array(bin.length)
        for (var i = 0; i < bin.length; i += 1) arr[i] = bin.charCodeAt(i)
        done(null, new Blob([arr], { type: 'image/png' }))
      } catch (err) {
        done(err)
      }
    }
  }

  function baseName(doc) {
    var t = doc && doc.meta && doc.meta.title
    if (typeof t === 'string' && t.trim()) {
      return t.trim().replace(/[\\/:*?"<>|]+/g, '-').slice(0, 60)
    }
    return 'diagram'
  }

  /**
   * @param {{ network: object, exportDocument: function(): object, activeDocument?: function(): object }} host
   */
  function bindExports(host) {
    function activeDoc() {
      if (typeof host.activeDocument === 'function') return host.activeDocument()
      if (host.network && typeof host.network.toJSON === 'function') return host.network.toJSON()
      return host.exportDocument()
    }

    return {
      downloadExcalidraw: function () {
        var doc = activeDoc()
        downloadText(
          baseName(doc) + '.excalidraw',
          JSON.stringify(toExcalidraw(doc), null, 2),
          'application/json',
        )
      },
      downloadDrawio: function () {
        var doc = activeDoc()
        downloadText(baseName(doc) + '.drawio', toDrawio(doc), 'application/xml')
      },
      downloadSvg: function () {
        var doc = activeDoc()
        downloadText(baseName(doc) + '.svg', toSvg(doc), 'image/svg+xml')
      },
      downloadPng: function () {
        toPngBlob(host.network, function (err, blob) {
          if (err) {
            console.error(err)
            return
          }
          downloadBlob(baseName(activeDoc()) + '.png', blob)
        })
      },
      // test hooks
      _toSvg: toSvg,
      _toExcalidraw: toExcalidraw,
      _toDrawio: toDrawio,
    }
  }

  global.TopoDiagramExport = {
    toSvg: toSvg,
    toExcalidraw: toExcalidraw,
    toDrawio: toDrawio,
    toPngBlob: toPngBlob,
    bindExports: bindExports,
    downloadBlob: downloadBlob,
    downloadText: downloadText,
  }
})(typeof globalThis !== 'undefined' ? globalThis : window)
