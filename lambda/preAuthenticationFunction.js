exports.handler = async function (event, context) {
    console.log(event)

    if (event.request.userAttributes.email === 'nbthales@live.com') {
        throw new Error('This user is blocked')
    }
    context.done(null, event)
}