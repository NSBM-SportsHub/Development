import assert from 'node:assert/strict';

export async function testEventPromotions({ check, Client, admin, newStudent, cli, sports }) {
  const anonymous = new Client();
  const student = await newStudent('event-student');
  const coach = await newStudent('event-coach');
  const club = await admin.request('/clubs', { method:'POST', body:{name:'Event Coach Club',sport_id:sports.Badminton} });
  assert.equal((await admin.request('/club-coaches',{method:'POST',body:{club_id:club.data.id,user_id:coach.id}})).status,201);
  const base = { title:'Campus Sports Day', description:'Synthetic activities fixture.', category:'sports_day', venue:'Campus ground', starts_at:'2090-01-01T09:00:00+05:30', ends_at:'2090-01-01T15:00:00+05:30' };
  async function create(body = {}) { const response = await admin.request('/event-promotions',{method:'POST',body:{...base,...body}}); assert.equal(response.status,201,JSON.stringify(response.error));return response.data; }
  await check('Event promotions restrict Admin CRUD and uploads; all writes require CSRF', async()=>{
    const record=await create();
    for (const [path,method,body] of [['/event-promotions','GET'],['/event-promotions','POST',base],[`/event-promotions/${record.id}`,'PATCH',{published:true}],[`/event-promotions/${record.id}`,'DELETE'],[`/event-promotions/${record.id}/banner`,'POST',{}],[`/event-promotions/${record.id}/banner`,'DELETE']]) {
      assert.equal((await anonymous.request(path,{method,body})).status,401);
      for(const client of [student,coach]) assert.equal((await client.request(path,{method,body})).status,403);
      if(method!=='GET') assert.equal((await admin.request(path,{method,body,token:false})).status,403);
    }
    assert.equal((await anonymous.request('/public/events/1/banner')).status,404);
    assert.equal((await admin.request(`/event-promotions/${record.id}`,{method:'PUT',body:base})).status,405);
  });
  await check('Only published, unexpired event details are public; dates normalize, ordering and removal persist',async()=>{
    const draft=await create();assert.equal(draft.published,false);assert.equal(draft.starts_at,'2090-01-01T03:30:00Z');
    assert.equal((await anonymous.request(`/public/events/${draft.id}`)).status,404);
    const liveStart=new Date(Date.now()-3600000).toISOString().replace(/\.\d{3}Z$/,'Z'),liveEnd=new Date(Date.now()+3600000).toISOString().replace(/\.\d{3}Z$/,'Z');
    const live=await create({title:'Live trial',category:'trial',starts_at:liveStart,ends_at:liveEnd,published:true,display_order:0});
    const upcoming=await create({title:'Next camp',category:'camp',published:true,display_order:5});
    const expired=await create({title:'Past activity',starts_at:'2020-01-01T09:00:00Z',ends_at:'2020-01-01T11:00:00Z',published:true});
    const listing=await anonymous.request('/public/events');assert.equal(listing.status,200);const ids=listing.data.events.map(e=>e.id);
    assert.ok(ids.includes(live.id)&&ids.includes(upcoming.id));assert.ok(!ids.includes(expired.id)&&!ids.includes(draft.id));assert.ok(ids.indexOf(live.id)<ids.indexOf(upcoming.id));
    const detail=(await anonymous.request(`/public/events/${live.id}`)).data;
    for (const field of ['created_by','cloud_name','public_id','version','published','deleted_at','tournament_status']) assert.equal(Object.hasOwn(detail,field),false);
    assert.equal((await anonymous.request('/public/events?published=false')).status,422);
    assert.equal((await anonymous.request(`/public/events/${expired.id}`)).status,404);
    assert.equal((await admin.request(`/event-promotions/${draft.id}`,{method:'PATCH',body:{published:true,title:'Published later'}})).status,200);
    assert.equal((await anonymous.request(`/public/events/${draft.id}`)).data.title,'Published later');
    assert.equal((await admin.request(`/event-promotions/${live.id}`,{method:'DELETE'})).status,204);
    assert.equal((await anonymous.request(`/public/events/${live.id}`)).status,404);
    assert.ok(!(await admin.request('/event-promotions')).data.events.some(e=>e.id===live.id));
    assert.equal((await admin.request(`/event-promotions/${live.id}`,{method:'PATCH',body:{published:true}})).status,404);
  });
  await check('Event validation rejects invalid dates, flags, links, image URLs and hidden tournament promotions',async()=>{
    for(const invalid of [{title:''},{ends_at:base.starts_at},{starts_at:'not-a-date'},{published:1},{featured:'true'},{display_order:-1},{banner_url:'https://untrusted.example/a.png'},{category:'unknown'},{tournament_id:123},{category:'tournament',tournament_id:null},{category:'tournament',tournament_id:99999999}]) assert.equal((await admin.request('/event-promotions',{method:'POST',body:{...base,...invalid}})).status,422,JSON.stringify(invalid));
    const tournament=await admin.request('/tournaments',{method:'POST',body:{name:'Promoted tournament',sport_id:sports.Badminton,format:'knockout',starts_on:'2090-01-01',ends_on:'2090-01-02'}});assert.equal(tournament.status,201);
    const event=await create({category:'tournament',tournament_id:tournament.data.id,published:true});
    assert.equal((await anonymous.request(`/public/events/${event.id}`)).status,404);
    assert.equal((await admin.request(`/tournaments/${tournament.data.id}`,{method:'PATCH',body:{status:'registration_open'}})).status,200);
    assert.equal((await anonymous.request(`/public/events/${event.id}`)).status,200);
    assert.equal((await admin.request(`/tournaments/${tournament.data.id}`,{method:'DELETE'})).status,204);
    assert.equal((await anonymous.request(`/public/events/${event.id}`)).status,404);
  });
  await check('Banner validation and unavailable provider leave event data intact',async()=>{
    const record=await create({published:true});const path=`/event-promotions/${record.id}/banner`;
    assert.equal((await admin.request(path,{method:'POST',body:{}})).status,415);
    const invalid=new FormData();invalid.append('banner',new Blob(['<svg></svg>'],{type:'image/svg+xml'}),'bad.svg');assert.equal((await admin.request(path,{method:'POST',body:invalid})).status,422);
    const valid=new FormData();valid.append('banner',new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64')],{type:'image/png'}),'banner.png');assert.equal((await admin.request(path,{method:'POST',body:valid})).status,503);
    assert.equal((await anonymous.request(`/public/events/${record.id}`)).data.banner_url,null);
    const result=JSON.parse(cli('backend/tests/event-promotions.php'));assert.equal(result.status,'passed');assert.equal(result.checks.length,9);
    // The guarded fixture helper restores the Admin's original session version after its checks.
  });
}
