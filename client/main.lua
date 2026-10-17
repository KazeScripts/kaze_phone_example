local function register()
    while GetResourceState('kaze_phone') ~= 'started' do Wait(200) end
    local res = GetCurrentResourceName()
    local ok, err = exports.kaze_phone:AddCustomApp({
        identifier = 'example-counter',
        name = 'Counter',
        ui = LoadResourceFile(res, 'ui/index.html'),
        icon = ('nui://%s/ui/icon.svg'):format(res),
        description = 'Counter example for Kaze Phone',
        defaultApp = false,
        addAppStore = false,
        developer = 'Kaze',
        notification = true,
        job = nil,
        onOpen = function() end,
        onClose = function() end,
    })
    if not ok then print('^1[kaze_phone_example] ' .. tostring(err) .. '^7') end
end

AddEventHandler('kaze_phone:client:loaded', register)
AddEventHandler('onClientResourceStart', function(r) if r == GetCurrentResourceName() then register() end end)
