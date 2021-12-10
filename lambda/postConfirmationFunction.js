exports.handler = async function (event, context) {
    console.log(event)

    context.done(null, event)
}