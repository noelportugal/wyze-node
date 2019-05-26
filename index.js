'use strict'
const axios = require('axios')
const md5 = require('md5')
const moment = require('moment')

class Wyze {

    /**
     * @param {object} options
     * @constructor
     */
    constructor (options) {
      this.username = options.username
      this.password = options.password
      this.baseUrl = options.baseUrl || "https://api.wyzecam.com:8443"
      this.phoneId = options.phoneId
      this.appVer = options.appVer || "com.hualai.WyzeCam___2.3.69"
      this.sc = "9f275790cab94a72bd206c8876429f3c"
      this.sv = "9d74946e652647e9b6c9d59326aef104"
      this.accessToken = options.accessToken  || ""
      this.refreshToken = options.refreshToken || ""     
    }


    /**
     * Set tokens
     */
    async setTokens(accessToken, refreshToken) {
        this.accessToken = accessToken
        this.refreshToken = refreshToken
      }

    /**
     * login to get access_token
     * @returns {data}
     */
    async getToken() {
        let result
        try {
            const reqBody = {
                phone_id: this.phoneId,
                sc: this.sc,
                password: md5(md5(this.password)),
                sv: "41267de22d1847c8b99bfba2658f88d7",
                user_name: this.username,
                two_factor_auth: "",
                phone_system_type: "1",
                app_ver: this.appVer,
                ts: moment().unix(),
                access_token: ""
            }

            result = await axios.post(`${this.baseUrl}/app/user/login`, reqBody)
            this.accessToken = result.data.data['access_token']
            this.refreshToken = result.data.data['refresh_token']

        }
        catch (e) {
            console.log('getToken error...', e)
            throw e
        }
        return result.data
    }

    /**
     * get refresh_token
     * @returns {data}
     */
    async refreshToken() {
        let result
        try {
            const reqBody = {
                phone_id: this.phoneId,
                app_ver: this.appVer,
                sc: this.sc,
                ts: moment().unix(),                
                sv: this.sv,
                access_token: this.accessToken,
                refresh_token: this.refreshToken
            }         
            result = await axios.post(`${this.baseUrl}/app/user/refresh_token`, reqBody)
            this.accessToken = result.data.data['access_token']
            this.refreshToken = result.data.data['refresh_token']
        }
        catch (e) {
            console.log('refreshToken error...', e)
            throw e
        }
        return result.data
    }

    /**
     * get objects list
     * @returns {data}
     */    
    async getObjectList() {
        let result
        try {

            if (this.accessToken === "") {
                console.log('Geting new token.....')
                await this.getToken()
            }

            const reqBody = {
                phone_id: this.phoneId,
                app_ver: this.appVer,
                sc: this.sc,
                ts: moment().unix(),                
                sv: this.sv,
                access_token: this.accessToken             
            }

            result = await axios.post(`${this.baseUrl}/app/v2/home_page/get_object_list`, reqBody)
            result.data.accessToken = this.accessToken
            result.data.refreshToken = this.refreshToken
            
            if (result.data.msg === 'AccessTokenError') {
                console.log('Refreshing tokens.....')
                await this.getToken()
                return this.getObjectList()
            }
        }
        catch (e) {
            console.log('Error...', e)
            throw e
        }
        return result.data
    }
}

module.exports = Wyze
