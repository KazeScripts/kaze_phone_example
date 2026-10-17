local counts = {}

AddEventHandler('kaze_phone:customApp:example-counter:get', function(src, _, cb)
    cb({ success = true, count = counts[src] or 0 })
end)

AddEventHandler('kaze_phone:customApp:example-counter:add', function(src, payload, cb)
    counts[src] = (counts[src] or 0) + (tonumber(payload.by) or 1)
    cb({ success = true, count = counts[src] })
end)

AddEventHandler('playerDropped', function() counts[source] = nil end)
